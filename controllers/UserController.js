const { User } = require("../models");
const { decode, encode } = require("../helpers/bcryct");
const { sign, verify } = require("../helpers/jwt");
const fetchGoogleUser = require("../helpers/googleAuth");
const generator = require("generate-password");
const { sendEmail, sendEmailForgotPassword } = require("../helpers/nodemailer");
const { Op } = require("sequelize");

class UserController {
  static async register(req, res, next) {
    try {
      let {
        email,
        password,
        username,
        fullname,
        phoneNumber = "",
        imgUrl = "",
        address = "",
      } = req.body;
      const result = await User.create({
        email,
        password,
        username,
        fullname,
        phoneNumber,
        imgUrl,
        address,
      });
      if (!result) throw { status: 400, message: "Register failed" };

      const token = sign({ email, username, id: result.id });

      const url = `http://localhost:3000/users/verification/${token}`;
      await sendEmail(email, url);

      res.status(201).json({
        status: 201,
        message: "We have sent you an verification link through email",
      });
    } catch (err) {
      next(err);
    }
  }

  static async verification(req, res, next) {
    try {
      const { accessToken } = req.params;
      const payload = verify(accessToken);

      await User.update(
        { status: "active" },
        {
          where: {
            id: payload.id,
            email: payload.email,
            username: payload.username,
          },
        }
      );
      res.status(200).json({ status: 200, message: "Your account is active" });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { emailOrUsername, password } = req.body;
      const currentUser = await User.findOne({
        where: {
          [Op.or]: [
            {
              email: {
                [Op.eq]: emailOrUsername,
              },
            },
            {
              username: {
                [Op.eq]: emailOrUsername,
              },
            },
          ],
        },
      });

      if (!currentUser) {
        throw {
          name: "authentication",
          message: "Wrong email/password",
        };
      }
      const isPasswordValid = decode(password, currentUser.password);
      if (isPasswordValid) {
        const access_token = sign({
          emailOrUsername,
          password,
        });
        res.status(200).json({
          id: currentUser.id,
          access_token,
          email: emailOrUsername,
          username: currentUser.username,
        });
      } else {
        throw {
          name: "authentication",
          message: "Wrong email/password",
        };
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  static async forgetPassword(req, res, next) {
    try {
      const { email } = req.body;
      const doesEmailExist = await User.findOne({
        where: {
          email,
        },
      });
      if (!doesEmailExist) {
        throw {
          name: "authentication",
          message: "Email doesnt exist",
        };
      }
      let newPassword = generator.generate({
        length: 10,
        numbers: true,
      });
      await User.update(
        { password: newPassword },
        {
          where: { email },
        }
      );
      sendEmailForgotPassword(email, newPassword);
      res.status(201).json({
        status: "ok",
        message: "Email has been sent. Check your email",
      });
    } catch (error) {
      next(error);
    }
  }

  static async googleLogin(req, res, next) {
    try {
      let idToken = req.body.idToken;
      let payload = await fetchGoogleUser(idToken);
      let { email, name } = payload;

      let user = await User.findOrCreate({
        where: { email },
        defaults: {
          username: name,
          email,
          password: "12345",
        },
      });
      let access_token = sign({ id: user[0].id, email: user[0].email });
      req.headers.access_token = access_token;
      res.status(200).json({
        access_token,
        username: user[0].username,
        userId: user[0].id,
      });
    } catch (err) {
      next(err);
    }
  }

  static async editPassword(req, res, next) {
    try {
      const { oldPassword, newPassword, confirmPassword } = req.body;
      const { id, email } = req.user;

      const currentPassword = await User.findOne({
        where: { id, email },
        attributes: ["password"],
      });

      if (newPassword !== confirmPassword) {
        throw {
          name: "update",
          message: "New password and Confirm password not the same",
        };
      }
      const passwordDecoded = decode(oldPassword, currentPassword.password);
      if (!passwordDecoded) {
        throw {
          name: "update",
          message: "Old password not same as previous password",
        };
      }
      console.log(newPassword);

      await User.update(
        {
          password: newPassword,
        },
        {
          where: { id, email },
          returning: true,
        }
      );
      res.status(200).json({
        status: 200,
        message: "Your password has changed, please Login Again",
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const { username, fullname, phoneNumber, imgUrl, address } = req.body;
      const { id, email } = req.user;

      const currentUser = await User.findOne({
        where: { id, email },
        attributes: [
          "username",
          "fullname",
          "phoneNumber",
          "imgUrl",
          "address",
        ],
      });

      const isDataChanged =
        JSON.stringify(currentUser) ===
        JSON.stringify({ username, fullname, phoneNumber, imgUrl, address });
      if (isDataChanged) {
        throw {
          name: "update",
          message: "No Changes",
        };
      }

      const updatedUser = await User.update(
        { username, fullname, phoneNumber, imgUrl, address },
        {
          where: { id, email },
          returning: true,
        }
      );

      res.status(200).json({ status: 200, message: "Your profile is updated" });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
