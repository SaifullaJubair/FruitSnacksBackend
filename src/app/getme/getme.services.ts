import { IUserInterface } from "../user/user.interface";
import UserModel from "../user/user.model";

// Check a user is exists?
export const findUserInfoServices = async (
  user_phone: string
): Promise<IUserInterface | null> => {
  const user = await UserModel.findOne({ user_phone: user_phone }).select(
    "-user_password -forgot_otp"
  );
  if (user) {
    return user;
  } else {
    return null;
  }
};

