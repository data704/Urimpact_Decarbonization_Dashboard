import { Outlet } from 'react-router-dom';
import './GHG.css';

export default function GHGModule() {
    return (
        <div className="ghg-module">
            <Outlet />
        </div>
    );
}
