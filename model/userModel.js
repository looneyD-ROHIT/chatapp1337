import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
	{
		name: {type: String, required: true, default: 'Anonymous'},
		username: { type: String, required: true, unique: true },
		password: { type: String, required: true },
        salt: String,
        admin: Boolean,
		createdAt: { type: Date, required: true, default: Date.now },
	},
	{ collection: 'users' }
);

const model = mongoose.model('UserSchema', userSchema);

export default model;

