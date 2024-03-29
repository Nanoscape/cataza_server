const UserController = require('../controllers/UserController');
const authentication = require('../middlewares/authentication');

const router = require('express').Router();

router.get('/', (req, res) => {
    res.send('INI DI USER ROUTER')
})

router.post('/register', UserController.register)
router.post('/login', UserController.login)
router.post('/forgot-password', UserController.forgetPassword)
router.post('/login-google', UserController.googleLogin)
router.get('/verification/:accessToken', UserController.verification);
router.use(authentication);
router.put('/update-profile', UserController.updateProfile)
router.put('/edit-password', UserController.editPassword)
module.exports = router;