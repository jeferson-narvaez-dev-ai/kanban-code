import mongoose, { Schema, Document } from 'mongoose';

export interface IEpic extends Document {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  projectIds: string[];
  path?: string;
}

const EpicSchema = new Schema<IEpic>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    color: { type: String, required: true },
    createdAt: { type: String },
    projectIds: { type: [String], default: [] },
    path: { type: String, required: false },
  },
  { timestamps: false, versionKey: false }
);

export const Epic = mongoose.model<IEpic>('Epic', EpicSchema);
