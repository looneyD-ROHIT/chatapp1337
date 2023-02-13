import mongoose from 'mongoose';

const room = new mongoose.Schema(
	{
        roomid: { type: String, required: true, unique: true},
		roomname: { type: String, required: true, default: 'chatroom1337' },
		createdAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: 'rooms' }
);

const model = mongoose.model('Rooms', room);

export default model;

