import mongoose from 'mongoose';

const messageDetails = new mongoose.Schema({
    message: { type: String, required: true },
	sentByName: { type: String, required: true},
    sentBy: { type: String, required: true },
    sentAt: { type: Date, required: true, default: Date.now },
})

const roomMessages = new mongoose.Schema(
	{
        roomid: { type: String, required: true, unique: true },
		roomname: { type: String, required: true, default: 'chatroom1337' },
		createdAt: { type: Date, required: true, default: Date.now },
		messages: {type: [messageDetails], default: []},
	},
	{ collection: 'roomMessages' }
);

const model = mongoose.model('RoomMessages', roomMessages);

export default model;

