// services/cognitoUsers.js
import AWS from "aws-sdk";

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.MY_AWS_REGION || "eu-north-1",
});

/**
 * Obtiene un mapa sub -> nombre visible para todos los usuarios del grupo "padres".
 * Usa los atributos "name" o (given_name + family_name) y, si no, el username.
 */
export const getParentsNameMap = async () => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    console.warn("⚠️ COGNITO_USER_POOL_ID no definido en .env");
    return {};
  }

  const params = {
    UserPoolId: userPoolId,
    GroupName: "padres",
    Limit: 60, // más que suficiente para tu proyecto
  };

  const res = await cognito.listUsersInGroup(params).promise();
  const users = res.Users || [];

  const map = {};

  users.forEach((user) => {
    const attrs = user.Attributes || [];
    const subAttr = attrs.find((a) => a.Name === "sub");
    const nameAttr = attrs.find((a) => a.Name === "name");
    const given = attrs.find((a) => a.Name === "given_name");
    const family = attrs.find((a) => a.Name === "family_name");

    if (!subAttr) return;

    const sub = subAttr.Value;

    let displayName = "";
    if (nameAttr && nameAttr.Value) {
      displayName = nameAttr.Value;
    } else {
      const parts = [];
      if (given && given.Value) parts.push(given.Value);
      if (family && family.Value) parts.push(family.Value);
      displayName = parts.join(" ");
    }

    if (!displayName) {
      displayName = user.Username || sub;
    }

    map[sub] = displayName;
  });

  return map;
};
