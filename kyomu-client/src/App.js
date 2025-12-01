function App() {
  const CLIENT_ID = "6ecfghfjbei1i7on9jtbibevbd";
  const REDIRECT_URI = "http://localhost:3000/";
  const COGNITO_DOMAIN = "https://eu-north-1entj8vbcc.auth.eu-north-1.amazoncognito.com";
  const RESPONSE_TYPE = "code";
  const SCOPE = "openid+email";

  const loginUrl = `${COGNITO_DOMAIN}/login?client_id=${CLIENT_ID}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&redirect_uri=${REDIRECT_URI}`;

  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>Kyomu Judo Login</h1>
      <a
        href={loginUrl}
        style={{
          padding: "12px 24px",
          backgroundColor: "#0066ff",
          color: "white",
          borderRadius: "8px",
          fontSize: "20px",
          textDecoration: "none"
        }}
      >
        Iniciar sesión con Cognito
      </a>
    </div>
  );
}

export default App;
