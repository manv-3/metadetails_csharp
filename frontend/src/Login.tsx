import { useState } from 'react';
import axios from 'axios';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleRegister = async () => {
        try {
            const res = await axios.post('/api/auth/register', { email, password });
            setMessage(res.data.message || 'Registered successfully');
        } catch (err: any) {
            setMessage(err.response?.data?.error || 'Registration failed');
        }
    };

    const handleLogin = async () => {
        try {
            const res = await axios.post('/api/auth/login', { email, password });
            localStorage.setItem('token', res.data.access_token);
            setMessage('Logged in successfully');
        } catch (err: any) {
            setMessage('Login failed');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setMessage('Logged out');
    };

    return (
        <div>
            <h2>Login / Register</h2>
            <div style={{ display: 'flex', flexDirection: 'column', width: '300px', gap: '10px' }}>
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <button onClick={handleLogin}>Login</button>
                <button onClick={handleRegister}>Register</button>
                <button onClick={handleLogout}>Logout</button>
            </div>
            {message && <p>{message}</p>}
        </div>
    );
};

export default Login;
