import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  id: string;
  name: string;
  createdAt: string;
  path?: string;
}

const ProjectSchema = new Schema<IProject>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    createdAt: { type: String },
    path: { type: String, required: false },
  },
  { timestamps: false, versionKey: false }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
