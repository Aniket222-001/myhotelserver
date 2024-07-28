
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/UserSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const Place = require('./models/Places');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const App = express();
const allowedOrigins = [
  'https://myhotel-frontend.vercel.app',
  'http://localhost:3000'
];

App.use(cors({
  origin: function (origin, callback) {
    // Check if the origin is in the allowedOrigins array or if there's no origin (like in non-browser requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
App.use(express.json());
App.use(cookieParser());

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

mongoose.connect('mongodb+srv://bloguser:bloguser@cluster0.pzyg7m3.mongodb.net/Blogdata')
  .then(() => {
    console.log('successfully connected to database');
  })
  .catch((e) => {
    console.log('failed to connect to database');
    console.log(e);
  });

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "jfhjkshgkjshgjks";

// Middleware for uploading images to Cloudinary directly
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads', // Cloudinary folder name
    format: async (req, file) => 'jpg', // supports promises as well
    public_id: (req, file) => Date.now() + '-' + file.originalname,
  },
});

const parser = multer({ storage: storage });

App.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userdoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userdoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

App.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userdoc = await User.findOne({ email });
    if (userdoc) {
      const passok = bcrypt.compareSync(password, userdoc.password);
      if (passok) {
        jwt.sign({ email: userdoc.email, id: userdoc._id }, jwtSecret, {}, (err, token) => {
          if (err) throw err;
          res.cookie('token', token).json(userdoc);
        });
      } else {
        res.status(422).json('wrong password');
      }
    } else {
      res.status(422).json('email not found');
      console.log('email not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('server error');
  }
});

App.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userdata) => {
      if (err) throw err;
      const { name, email, id } = await User.findById(userdata.id);
      res.json({ name, email, id });
    });
  } else {
    res.json(null);
  }
});

App.post('/Logout', (req, res) => {
  res.cookie('token', '').json(true);
});

App.post('/upload-by-link', async (req, res) => {
  try {
    const { link } = req.body;

    // Log the received link
    console.log('Received link:', link);

    // Simple validation to check for HTTP/HTTPS URLs
    if (!link || !/^https?:\/\//.test(link)) {
      console.log('Invalid URL:', link);
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Create a new file name and destination path
    const newName = Date.now() + '.jpg';
    const dest = path.join(__dirname, 'Uploads', newName);

    // Download the image
    await imageDownloader.image({
      url: link,
      dest: dest
    });

    // Upload the downloaded image to Cloudinary
    const newFilePath = await uploadToCloudinary(dest);

    // Delete the temporary file
    fs.unlinkSync(dest);

    // Send the new file name as the response
    res.json({ filename: newFilePath });
  } catch (e) {
    console.error('Failed to upload photo:', e);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

App.post('/upload', parser.array('photos', 100), (req, res) => {
  const uploadedFiles = req.files.map(file => file.path);
  res.json(uploadedFiles);
});

App.post('/places', (req, res) => {
  const { token } = req.cookies;
  const {
    title,selectedOption, address, addedPhotos,
    description, perks, extraInfo,
    checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,selectedOption, address, photos: addedPhotos,
      description, perks, extraInfo,
      checkIn, checkOut, maxGuests, price
    });
    res.json(placeDoc);
  });
});

App.get('/user-places', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

App.get('/places/:id', async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

App.put('/places', async (req, res) => {
  const { token } = req.cookies;
  const {
    id, title,selectedOption, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,selectedOption, address, photos: addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});
App.get('/places', async (req, res) => {
  res.json(await Place.find());
});



App.get('/',(req,res)=>{
    return res.status(404).json({
        meassage: "sever Domain is runnin nicely so what"
    })
})

App.listen(4000, () => {
  console.log('Server is running on port 4000');
});
