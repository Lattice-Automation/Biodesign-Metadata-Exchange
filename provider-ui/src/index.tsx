import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Home from './pages/Home';
import OldHome from './pages/old/OldHome';
import OldAdmin from './pages/old/OldAdmin';
import DesignGraph from './pages/DesignGraph';
import Settings from './pages/Settings';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home/>,
  },
  {
    path: "/old-home",
    element: <OldHome/>,
  },
  {
    path: "/old-admin",
    element: <OldAdmin/>,
  },
  {
    path: "/design-graph",
    element: <DesignGraph/>,
  },
  {
    path: "/settings",
    element: <Settings/>,
  },
]);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
