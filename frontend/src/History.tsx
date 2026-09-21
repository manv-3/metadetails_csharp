import { useEffect, useState } from 'react';
import axios from 'axios';

const History = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in to view history.');
                return;
            }
            try {
                const res = await axios.get('/api/history', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setHistory(res.data);
            } catch (err) {
                setError('Failed to fetch history.');
            }
        };
        fetchHistory();
    }, []);

    const deleteScan = async (id: string) => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/history/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setHistory(history.filter(h => h.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <h2>Scan History</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {history.map((scan) => (
                    <li key={scan.id} style={{ marginBottom: '10px', border: '1px solid #ccc', padding: '10px' }}>
                        <strong>{scan.name}</strong> ({scan.scanType}) - {new Date(scan.createdAt).toLocaleString()}
                        <button onClick={() => deleteScan(scan.id)} style={{ marginLeft: '10px' }}>Delete</button>
                        <pre style={{ fontSize: '0.8em' }}>{JSON.stringify(scan.result, null, 2)}</pre>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default History;
