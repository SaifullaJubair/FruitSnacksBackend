
import { authenticationSearchableField, IAuthenticationInterface } from "./authentication.interface";
import AuthenticationModel from "./authentication.model";

// Create A Authentication
export const postAuthenticationServices = async (
  data: IAuthenticationInterface
): Promise<IAuthenticationInterface | {}> => {
  const createAuthentication: IAuthenticationInterface | {} = await AuthenticationModel.create(
    data
  );
  return createAuthentication;
};

// Find all dashboard Authentication
export const findAllDashboardAuthenticationServices = async (
  limit: number,
  skip: number,
  searchTerm: any
): Promise<IAuthenticationInterface[] | []> => {
  const andCondition = [];
  if (searchTerm) {
    andCondition.push({
      $or: authenticationSearchableField.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  const whereCondition: any =
    andCondition.length > 0 ? { $and: andCondition } : {};

  // Start building the query
  const findAuthentication = AuthenticationModel.find(whereCondition)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .select("-__v");

  return findAuthentication;
};

// Find all  Authentication
export const findAllAuthenticationServices = async (
): Promise<IAuthenticationInterface[] | []> => {
  // Start building the query
  const findAuthentication = AuthenticationModel.find({
  })
    .sort({ _id: -1 })
    .select("-__v");

  return findAuthentication;
};

// Update a Authentication
export const updateAuthenticationServices = async (
  data: IAuthenticationInterface,
  _id: string
): Promise<IAuthenticationInterface | any> => {
  const updateAuthenticationInfo: IAuthenticationInterface | null =
    await AuthenticationModel.findOne({
      _id: _id,
    });
  if (!updateAuthenticationInfo) {
    return {};
  }
  const Authentication = await AuthenticationModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Authentication;
};

// Delete a Authentication
export const deleteAuthenticationServices = async (
  _id: string
): Promise<IAuthenticationInterface | any> => {
  const Authentication = await AuthenticationModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Authentication;
};
