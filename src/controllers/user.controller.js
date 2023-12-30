import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

//private method: generate access and refresh token
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token!"
    );
  }
};

//public method: register a user
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  //validate the request
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required!");
  }

  //check if the user exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists!");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    //check for avatar
    throw new ApiError(400, "Avatar file is required!");
  }

  //upload images to coludinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required!");
  }

  //create user object in db
  const user = await User.create({
    fullname,
    email,
    password,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  //check user is created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user!");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

//public method: login a user
const loginUser = asyncHandler(async (req, res) => {
  //Algo steps:
  //req body -> data
  //username or email
  //find the user
  //password check
  //access and refresh token
  //send cookie

  const { email, username, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "username or email is reqiuired!");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new ApiError(404, "User does not exists!");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is invalid!");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  //send cookie
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            username: user.username,
            email: user.email,
            fullname: user.fullname,
            avatar: user.avatar,
            coverImage: user.coverImage,
            watchHistory: user.watchHistory,
          },
          accessToken,
          refreshToken,
        },
        "user logged in successfully"
      )
    );
});

//public method: logout a user
const logoutUser = asyncHandler(async (req, res) => {
  const user = req.user;
  //return res.status(200).json(req.user._id);
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  //send cookie
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cokkies?.refreshToken || req.body.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "Unauthorized access!");
  }

  try {
    const decodedToekn = await jwt.verify(
      refreshToken,
      process.env.REFEESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToekn?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token!");
    }

    if (refreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired!");
    }

    const { newAccessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(decodedToekn?._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed!"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token!");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
