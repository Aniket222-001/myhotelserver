const mongoose = require('mongoose')
// const { type } = require('os')

const Userschema = new mongoose.Schema({
    name: { type: String, default: 'Anonymous' },
    email:{type:String,unique:true},
    password:String
})

const usermodel = mongoose.model('User',Userschema)

module.exports = usermodel;