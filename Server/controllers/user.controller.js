import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/dataUri.js";
import cloudinary from "../utils/cloudinary.js"

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res
        .status(401)
        .json({ message: "All fields are required", success: false });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res
        .status(401)
        .json({ message: "Email already exists", success: false });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashPassword });
    return res
      .status(201)
      .json({ message: "User created successfully", success: true });
  } catch (error) {
    console.log(error);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(401)
        .json({ message: "All fields are required", success: false });
    }
    let user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid credentials", success: false });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res
        .status(401)
        .json({ message: "Invalid credentials", success: false });
    }
    user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      posts: user.posts,
    };
    const token = await jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });
    return res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 86400000,
      })
      .json({
        message: `Wellcome back ${user.username}`,
        success: true,
        user,
      });
  } catch (error) {
    console.log(error);
  }
};

export const logout = (_, res) => {
  try {
    return res.clearCookie("token").json({
      message: "Logout successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    let user = await User.findById(userId).select("-password");
    return res.status(200).json({ user, success: true });
  } catch (error) {
    console.log(error);
  }
};

export const editProfile = async (req, res) => {
  try {
    const userId = req.id;
    const { bio, gender } = req.body;
    const profilePicture = req.file;
    let cloudResponse;
    if (profilePicture) {
      const fileUri = getDataUri(profilePicture);
      cloudResponse = await cloudinary.uploader.upload(fileUri);
    }
    let user = await User.findById(userId).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    if (bio) user.bio = bio;
    if (gender) user.gender = gender;
    if (profilePicture) user.profilePicture = cloudResponse.secure_url;
    await user.save();
    return res
      .status(200)
      .json({ message: "Profile updated successfully", success: true, user });
  } catch (error) {
    console.log(error);
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const SuggestedUsers = await User.find({ _id: { $ne: req.id } })
      .select("-password")
      .limit(5);
    if (!SuggestedUsers) {
      return res.status(404).json({ message: "No user found", success: false });
    }
    return res.status(200).json({ users: SuggestedUsers, success: true });
  } catch (error) {
    console.log(error);
  }
};

// export const followUser = async (req, res) => {
//   try {
//     const userId = req.id;
//     const { followId } = req.body;
//     let user;
//     let followUser;
//     if (userId === followId) {
//       return res
//         .status(400)
//         .json({ message: "You can't follow yourself", success: false });
//     }
//     user = await User.findById(userId);
//     followUser = await User.findById(followId);
//     if (!user || !followUser) {
//       return res
//         .status(404)
//         .json({ message: "User not found", success: false });
//     }
//     if (user.following.includes(followId)) {
//       return res
//         .status(400)
//         .json({ message: "You already follow this user", success: false });
//     }
//     user.following.push(followId);
//     followUser.followers.push(userId);
//     await user.save();
//     await followUser.save();
//     return res
//       .status(200)
//       .json({ message: "User followed successfully", success: true });
//   } catch (error) {
//     console.log(error);
//   }
// };

export const followOrUnfollowUser = async (req, res) => {
  try {
    const followKarnerWala = req.id;
    const jiskoFollowKrunga = req.params.id;
    if (followKarnerWala === jiskoFollowKrunga) {
      return res
        .status(400)
        .json({ message: "You can't follow yourself", success: false });
    }
    const user = await User.findById(followKarnerWala);
    const targetUser = await User.findById(jiskoFollowKrunga);
    if (!user || !targetUser) {
      return res
        .status(404)
        .json({ message: "User not found", success: false });
    }
    // abhi check kro ki follow kr rha h ya unfollow
    const isFollowing = user.following.includes(jiskoFollowKrunga);
    if (isFollowing) {
      //allready following hai to unfollow krna hai
      await Promise.all([
        User.updateOne(
          { _id: followKarnerWala },
          { $pull: { following: jiskoFollowKrunga } }
        ),
        User.updateOne(
          { _id: jiskoFollowKrunga },
          { $pull: { followers: followKarnerWala } }
        ),
      ]);
      return res
        .status(200)
        .json({ message: "User unfollowed successfully", success: true });
    } else {
      //follow krna hai
      await Promise.all([
        User.updateOne(
          { _id: followKarnerWala },
          { $push: { following: jiskoFollowKrunga } }
        ),
        User.updateOne(
          { _id: jiskoFollowKrunga },
          { $push: { followers: followKarnerWala } }
        ),
      ]);
      return res
        .status(200)
        .json({ message: "User followed successfully", success: true });
    }
  } catch (error) {
    console.log(error);
  }
};
