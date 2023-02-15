import mongoose from 'mongoose';


const connectionData = new mongoose.Schema({
	connectionname: { type: String, required: true },	
    connectionid: { type: String, required: true, unique: true },
    isroom: { type: Boolean, required: true },
	connectionusername: { type: String, required: false },
})

const userConnectionsSchema = new mongoose.Schema(
	{
		username: { type: String, required: true, unique: true },
        connectionList: { type: [connectionData], required: true}
	},
	{ collection: 'userconnections' }
);

const model = mongoose.model('UserConnectionsSchema', userConnectionsSchema);

export default model;

