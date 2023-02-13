import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
	{
        roomid: { type: String, required: true, unique: true },
		createdAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: 'rooms' }
);

const model = mongoose.model('RoomSchema', roomSchema);

export default model;

