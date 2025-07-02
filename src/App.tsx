import React from 'react';
import { OneLiner } from './OneLiner';
import { Routes, Route } from "react-router-dom";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={
        <div className="w-full">
          <OneLiner />
        </div>
      } />
    </Routes>
  );
};

export default App;
