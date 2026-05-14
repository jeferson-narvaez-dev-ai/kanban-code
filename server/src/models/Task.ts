import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  tags: string[];
  createdAt: string;
  projectId?: string;
  epicId?: string;
  parentProjectId?: string;
  contextType: 'epic' | 'project';
  contextId: string;
}

const TaskSchema = new Schema<ITask>(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], required: true },
    tags: { type: [String], default: [] },
    createdAt: { type: String },
    projectId: { type: String },
    epicId: { type: String },
    parentProjectId: { type: String },
    contextType: { type: String, enum: ['epic', 'project'], required: true },
    contextId: { type: String, required: true },
  },
  { timestamps: false, versionKey: false }
);

export const Task = mongoose.model<ITask>('Task', TaskSchema);
