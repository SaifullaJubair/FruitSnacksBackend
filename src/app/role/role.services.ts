import ApiError from "../../errors/ApiError";
import AdminModel from "../adminRegLog/admin.model";
import { IRoleInterface } from "./role.interface";
import RoleModel from "./role.model";

// Find A Role with Slug
export const findARoleSlugServices = async (
  role_name: string
): Promise<IRoleInterface | null> => {
  const findRole: IRoleInterface | null = await RoleModel.findOne({
    role_name: role_name,
  });
  return findRole;
};

// Create A Role
export const postRoleServices = async (
  data: IRoleInterface
): Promise<IRoleInterface | {}> => {
  const createRole: IRoleInterface | {} = await RoleModel.create(data);
  return createRole;
};

// Find all dashboard Role
export const findAllDashboardRoleServices = async (): Promise<
  IRoleInterface[] | []
> => {
  const findRole: IRoleInterface[] | [] = await RoleModel.find()
    .sort({ _id: -1 })
    .select("-__v");
  return findRole;
};

// Update a Role
export const updateRoleServices = async (
  data: IRoleInterface,
  _id: string
): Promise<IRoleInterface | any> => {
  const updateRoleInfo: IRoleInterface | null = await RoleModel.findOne({
    _id: _id,
  });
  if (!updateRoleInfo) {
    throw new ApiError(400, "Role Not Found !");
  }
  const Role = await RoleModel.updateOne({ _id: _id }, data, {
    runValidators: true,
  });
  return Role;
};

// delete a Role start

// Find A Role in user Registration
export const findARoleInUserServices = async (
  role_id: string
): Promise<any | null> => {
  const findRole: any | null = await AdminModel.findOne({
    role_id: role_id,
  });
  return findRole;
};

export const deleteRoleServices = async (
  _id: string
): Promise<IRoleInterface | any> => {
  const deleteRoleInfo: IRoleInterface | null = await RoleModel.findOne({
    _id: _id,
  });
  if (!deleteRoleInfo) {
    throw new ApiError(400, "Role Not Found !");
  }
  const Role = await RoleModel.deleteOne(
    { _id: _id },
    {
      runValidators: true,
    }
  );
  return Role;
};
