import {
  ownerContextFromAuthenticatedRequest,
  ownerUserIdFromAuthenticatedRequest,
} from "../../auth/OwnerContext";

export const ownerContextFrom = ownerContextFromAuthenticatedRequest;
export const userIdFrom = ownerUserIdFromAuthenticatedRequest;
