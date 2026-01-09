window.awsconfig = {
  aws_project_region: "eu-north-1",
  aws_cognito_region: "eu-north-1",
  aws_user_pools_id: "eu-north-1_ENtj8vBCc",
  aws_user_pools_web_client_id: "6ecfghfjbei1i7on9jtbibevbd",

  oauth: {
    domain: "eu-north-1entj8vbcc.auth.eu-north-1.amazoncognito.com",
    scope: ["openid", "profile", "email"],
    // 🚀 ACTUALIZADO: Ahora apunta a tu URL de Amplify
    redirectSignIn: "https://main.d2hoslvqyftwz.amplifyapp.com/login.html",
    redirectSignOut: "https://main.d2hoslvqyftwz.amplifyapp.com/login.html",
    // Mantenemos "code" si así configuraste tu Cognito
    responseType: "code"
  }
};