import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer'


function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])

    return <code {...props} ref={ref} />
}


const Project = () => {

    const location = useLocation()

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set())
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = useRef(null)

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([]) 
    const [ fileTree, setFileTree ] = useState({})

    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])

    const [ webContainer, setWebContainer ] = useState(null)
    const [ iframeUrl, setIframeUrl ] = useState(null)
    const [ runProcess, setRunProcess ] = useState(null)

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }
            return newSelectedUserId;
        });
    }

    function addCollaborators() {
        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            setIsModalOpen(false)
        }).catch(err => {
            console.log(err)
        })
    }

    const send = () => {
        sendMessage('project-message', {
            message,
            sender: user
        })
        setMessages(prevMessages => [ ...prevMessages, { sender: user, message } ])
        setMessage("")
        setTimeout(scrollToBottom, 100)
    }

    // Helper to render AI messages cleanly
    function renderMessage(msg) {
        if (msg.sender._id !== 'ai') {
            return <p>{msg.message}</p>
        }

        return (
            <div className='overflow-auto bg-slate-950 text-white rounded-sm p-2'>
                <Markdown
                    children={msg.message}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />
            </div>
        )
    }

    useEffect(() => {
        initializeSocket(project._id)

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("container started")
            })
        }

        receiveMessage('project-message', data => {
            if (data.sender._id === 'ai') {
                try {
                    const jsonMatch = data.message.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonMatch) {
                        const parsedData = JSON.parse(jsonMatch[1]);
                        
                        if (parsedData.fileTree) {
                            // Mount to WebContainer
                            webContainer?.mount(parsedData.fileTree);
                            // Update state - ensure it's not null/undefined
                            setFileTree(parsedData.fileTree || {});
                        }

                        if (parsedData.text) {
                            data.message = parsedData.text;
                        }
                    }
                } catch (err) {
                    console.log("JSON parsing failed, treating as plain text");
                }
            }
            setMessages(prevMessages => [...prevMessages, data]);
            setTimeout(scrollToBottom, 100);
        });

        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {
            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get('/users/all').then(res => {
            setUsers(res.data.users)
        })

    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        })
    }

    function scrollToBottom() {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight
        }
    }

    return (
        <main className='h-screen w-screen flex'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300 border-r border-slate-400">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                    <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill"></i> <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>

                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">
                    <div ref={messageBox} className="message-box p-1 flex-grow flex flex-col gap-1 overflow-auto scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div key={index} className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id == user._id.toString() && 'ml-auto'} message flex flex-col p-2 bg-slate-50 w-fit rounded-md shadow-sm`}>
                                <small className='opacity-65 text-[10px]'>{msg.sender.email}</small>
                                <div className='text-sm'>
                                    {renderMessage(msg)}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0 shadow-lg">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && send()}
                            className='p-2 px-4 border-none outline-none flex-grow' 
                            type="text" 
                            placeholder='Enter message (use @ai for help)' 
                        />
                        <button onClick={send} className='px-5 bg-slate-950 text-white'>
                            <i className="ri-send-plane-fill"></i>
                        </button>
                    </div>
                </div>

                {/* Side Panel for Collaborators */}
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all z-20 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>
                        <h1 className='font-semibold'>Collaborators</h1>
                        <button onClick={() => setIsSidePanelOpen(false)}><i className="ri-close-fill"></i></button>
                    </header>
                    <div className="users flex flex-col">
                        {project.users && project.users.map((u, i) => (
                            <div key={i} className="user p-2 flex gap-2 items-center hover:bg-slate-100">
                                <div className='w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs'>
                                    <i className="ri-user-fill"></i>
                                </div>
                                <h1 className='text-sm'>{u.email}</h1>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="right bg-white flex-grow h-full flex overflow-hidden">
                <div className="explorer h-full w-64 bg-slate-200 border-r border-slate-300">
                    <div className="file-tree w-full">
                        {fileTree && Object.keys(fileTree).map((file, index) => (
                            <button key={index} 
                                onClick={() => { 
                                    if (fileTree[file] && fileTree[file].file) {
                                        setCurrentFile(file); 
                                        setOpenFiles([...new Set([...openFiles, file])]) 
                                    }
                                }}
                                className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 hover:bg-slate-300 w-full text-left">
                                <p className='text-sm font-medium'>
                                    {fileTree[file].directory ? '📁 ' : '📄 '}
                                    {file}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="code-editor flex flex-col flex-grow h-full overflow-hidden">
                    <div className="top flex justify-between bg-slate-100 border-b border-slate-300">
                        <div className="files flex overflow-x-auto">
                            {openFiles.map((file, index) => (
                                <button key={index} onClick={() => setCurrentFile(file)}
                                    className={`p-2 px-4 border-r border-slate-300 text-sm transition-colors ${currentFile === file ? 'bg-white font-bold' : 'bg-slate-50'}`}>
                                    {file}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={async () => {
                                await webContainer.mount(fileTree);
                                if (fileTree['package.json']) {
                                    const install = await webContainer.spawn("npm", ["install"]);
                                    install.output.pipeTo(new WritableStream({ write(c) { console.log(c) } }));
                                    await install.exit;
                                    
                                    if (runProcess) runProcess.kill();
                                    const run = await webContainer.spawn("npm", ["start"]);
                                    setRunProcess(run);
                                    webContainer.on('server-ready', (p, url) => setIframeUrl(url));
                                } else {
                                    alert("No package.json found. Please ask @ai to 'add a server setup'.");
                                }
                            }} 
                            className='m-1 px-4 bg-green-600 text-white rounded text-xs'
                        >Run</button>
                    </div>
                    
                    <div className="bottom flex-grow overflow-auto bg-[#1e1e1e]">
                        {currentFile && fileTree[currentFile] && fileTree[currentFile].file && (
                            <pre className="h-full p-4 outline-none text-white font-mono text-sm">
                                <code
                                    className="outline-none"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                        const updatedContent = e.target.innerText;
                                        const ft = { ...fileTree, [currentFile]: { file: { contents: updatedContent } } };
                                        setFileTree(ft);
                                        saveFileTree(ft);
                                    }}
                                    dangerouslySetInnerHTML={{ __html: hljs.highlightAuto(fileTree[currentFile].file.contents).value }}
                                    style={{ whiteSpace: 'pre-wrap' }}
                                />
                            </pre>
                        )}
                    </div>
                </div>

                {iframeUrl && (
    <div className="preview min-w-[400px] border-l border-slate-300 flex flex-col bg-white">
        {/* URL Address Bar */}
        <div className="address-bar bg-slate-100 p-2 border-b flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-3 py-1 flex-grow shadow-sm">
                <i className="ri-lock-line text-green-600 text-xs"></i>
                <input 
                    type="text" 
                    readOnly 
                    value={iframeUrl} 
                    className="w-full text-xs text-slate-600 outline-none bg-transparent truncate"
                />
            </div>
            <button 
                onClick={() => setIframeUrl(null)} 
                className="bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-xs text-slate-600 transition-colors"
            >
                Close
            </button>
        </div>

        {/* The Website Preview */}
        <iframe src={iframeUrl} className="w-full h-full border-none" />
    </div>
)}
            </section>

            {/* Collaborator Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-4 shadow-xl">
                        <header className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Add Collaborators</h2>
                            <button onClick={() => setIsModalOpen(false)} className="ri-close-line text-xl"></button>
                        </header>
                        <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
                            {users.map((u) => (
                                <div 
                                    key={u._id} 
                                    onClick={() => handleUserClick(u._id)}
                                    className={`p-2 flex items-center gap-3 cursor-pointer rounded ${selectedUserId.has(u._id) ? 'bg-blue-100' : 'hover:bg-slate-100'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white"><i className="ri-user-line"></i></div>
                                    <p className="text-sm">{u.email}</p>
                                </div>
                            ))}
                        </div>
                        <button onClick={addCollaborators} className="w-full mt-4 py-2 bg-blue-600 text-white rounded font-medium">Update Collaborators</button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project;
