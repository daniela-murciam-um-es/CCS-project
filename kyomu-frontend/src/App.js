import React, { useEffect, useState } from "react";
import { Amplify, Auth } from "aws-amplify";
import awsmobile from "./aws-exports";
import logo from "./assets/kyomu.png";

Amplify.configure(awsmobile);

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then(async (user) => {
        setUser(user);
        
        // --- NUEVO: Sincronizar token para scripts.js ---
        const session = await Auth.currentSession();
        const idToken = session.getIdToken().getJwtToken();
        localStorage.setItem("kyomu_idToken", idToken); // 
        // -----------------------------------------------
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem("kyomu_idToken"); 
      });
  }, []);

  const login = () => Auth.federatedSignIn();
  
  const logout = () => {
    localStorage.removeItem("kyomu_idToken"); 
    Auth.signOut({ global: true });
  };

  return (
    <div className="App">
      <header className="header">
        <img src={logo} alt="Kyomu Logo" className="logo"/>
        <h1>Kyomu Judo</h1>
      </header>

      {user ? (
        <div className="session">
          <h2>Bienvenido, {user.attributes.email}</h2>
          <p>La sesión está activa. Ahora puedes usar las funciones de la web.</p>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      ) : (
        <div className="session">
          <h2>Inicia sesión para continuar</h2>
          <button onClick={login}>Login con Cognito</button>
        </div>
      )}
    </div>
  );
}