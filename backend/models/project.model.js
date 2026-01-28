import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user"
    }
  ],
  fileTree: {
    type: Object,
    default: {}
  }
});

// ✅ unique per user
projectSchema.index(
  { name: 1, users: 1 },
  { unique: true }
);

const Project = mongoose.model("project", projectSchema);
export default Project;
