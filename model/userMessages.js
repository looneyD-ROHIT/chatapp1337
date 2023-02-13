import mongoose from 'mongoose';

const messageDetails = new mongoose.Schema({
    messageid: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    sentBy: { type: String, required: true },
    sentTo: { type: String, required: true },
    sentAt: { type: Date, required: true, default: Date.now },
},
{
    collection: 'usermessages'
})

const model = mongoose.model('UserMessagesSchema', messageDetails);

export default model;

