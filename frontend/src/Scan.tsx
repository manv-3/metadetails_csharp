import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import axios from 'axios';

interface FileResult {
    filename?: string;
    name?: string;
    metadata?: Record<string, any>;
    gps?: { latitude?: any; longitude?: any; GPSLatitude?: any; GPSLongitude?: any };
}

const Scan = () => {
    const [mode, setMode] = useState<'file' | 'url'>('file');
    const [files, setFiles] = useState<File[]>([]);
    const [url, setUrl] = useState('');
    const [depth, setDepth] = useState(1);
    const [scanOnly, setScanOnly] = useState(false);
    
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [showProgress, setShowProgress] = useState(false);
    
    const [results, setResults] = useState<FileResult[] | null>(null);
    const [activeTab, setActiveTab] = useState<'summary' | 'all-fields' | 'timeline' | 'map'>('summary');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addFiles = (newFiles: File[]) => {
        setFiles(prev => {
            const added = [...prev];
            newFiles.forEach(f => {
                if (!added.some(x => x.name === f.name && x.size === f.size)) {
                    added.push(f);
                }
            });
            return added;
        });
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const animateProgress = (from: number, to: number, durationMs: number) => {
        let current = from;
        const steps = 30;
        const increment = (to - from) / steps;
        const stepMs = durationMs / steps;
        
        const timer = setInterval(() => {
            current += increment;
            setProgress(Math.min(100, current));
            if (current >= to) clearInterval(timer);
        }, stepMs);
    };

    const handleAnalyze = async () => {
        if (!files.length) return;
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        setShowProgress(true);
        setProgressLabel('Uploading files…');
        animateProgress(10, 40, 1200);

        try {
            const token = localStorage.getItem('token');
            setTimeout(() => setProgressLabel('Running ExifTool…'), 1200);
            animateProgress(40, 85, 2000);

            const res = await axios.post('/api/analyze', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            animateProgress(85, 100, 300);
            setTimeout(() => {
                setShowProgress(false);
                setResults(res.data);
                setActiveTab('summary');
            }, 400);
        } catch (error) {
            console.error(error);
            setShowProgress(false);
            alert('Analysis failed');
        }
    };

    const handleScrape = async () => {
        if (!url) {
            alert('Please enter a valid URL');
            return;
        }

        setShowProgress(true);
        setProgressLabel('Connecting to target…');
        animateProgress(5, 30, 1500);

        try {
            setTimeout(() => setProgressLabel(`Crawling ${url} (depth ${depth})…`), 1500);
            animateProgress(30, 70, 3000);

            const token = localStorage.getItem('token');
            const res = await axios.post('/api/scrape', { url, depth, scanOnly }, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            
            animateProgress(70, 100, 400);
            setTimeout(() => {
                setShowProgress(false);
                setResults(res.data);
                setActiveTab('summary');
            }, 500);
        } catch (error) {
            console.error(error);
            setShowProgress(false);
            alert('Scraping failed');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objUrl);
    };

    const handleExportJson = () => {
        if (!results) return;
        downloadFile(JSON.stringify(results, null, 2), `metadetective-${new Date().getTime()}.json`, 'application/json');
    };

    const renderSummary = () => {
        if (!results) return null;
        const allMeta = results.flatMap(r => Object.entries(r.metadata || {}));
        
        const keyMap: Record<string, Set<string>> = {};
        results.forEach(r => {
            Object.entries(r.metadata || {}).forEach(([k, v]) => {
                if (!keyMap[k]) keyMap[k] = new Set();
                keyMap[k].add(String(v));
            });
        });

        const sortedKeys = Object.keys(keyMap).sort((a, b) => keyMap[b].size - keyMap[a].size);

        return (
            <div className="summary-field-section">
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{results.length}</div>
                        <div className="stat-label">Files Analyzed</div>
                    </div>
                </div>
                <h3>All Metadata Fields</h3>
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Field</th>
                                <th>Unique Values</th>
                                <th style={{textAlign: 'right'}}>Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedKeys.map(key => {
                                const vals = Array.from(keyMap[key]).slice(0, 5);
                                return (
                                    <tr key={key}>
                                        <td className="text-mono" style={{whiteSpace: 'nowrap', color: 'var(--text-muted)'}}>{key}</td>
                                        <td>
                                            {vals.map((v, i) => <span key={i} style={{display: 'inline-block', marginRight: '6px', marginBottom: '4px'}}>{v.substring(0, 80)}</span>)}
                                            {keyMap[key].size > 5 && <span className="badge badge-default">+{keyMap[key].size - 5} more</span>}
                                        </td>
                                        <td style={{textAlign: 'right', color: 'var(--text-muted)'}}>{keyMap[key].size}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderAllFields = () => {
        if (!results) return null;
        return (
            <div className="accordion">
                {results.map((r, idx) => (
                    <div key={idx} className="accordion-item open">
                        <div className="accordion-header">
                            <span>{r.filename || r.name || `File ${idx + 1}`}</span>
                            <span className="badge badge-default">{Object.keys(r.metadata || {}).length} fields</span>
                        </div>
                        <div className="accordion-body">
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Field</th><th>Value</th></tr></thead>
                                    <tbody>
                                        {Object.entries(r.metadata || {}).map(([k, v]) => (
                                            <tr key={k}>
                                                <td className="text-mono" style={{color: 'var(--text-muted)'}}>{k}</td>
                                                <td style={{wordBreak: 'break-all'}}>{String(v)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderTimeline = () => {
        if (!results) return null;
        const dateFields = [
            'CreateDate','ModifyDate','FileModifyDate','DateTimeOriginal',
            'MetadataDate','TrackCreateDate','TrackModifyDate','MediaCreateDate',
            'MediaModifyDate','ContentCreateDate','LastModifiedDate','DateCreated'
        ];
        
        const events: any[] = [];
        results.forEach(r => {
            const meta = r.metadata || {};
            dateFields.forEach(field => {
                if (meta[field]) {
                    const date = new Date(meta[field]);
                    if (!isNaN(date.getTime())) {
                        events.push({
                            date,
                            label: field,
                            filename: r.filename || r.name || 'Unknown',
                            raw: meta[field]
                        });
                    }
                }
            });
        });

        if (!events.length) {
            return (
                <div className="empty-state">
                    <h3>No date fields found</h3>
                    <p>The analyzed files did not contain recognizable date metadata.</p>
                </div>
            );
        }

        events.sort((a, b) => a.date - b.date);

        return (
            <div className="timeline">
                {events.map((ev, i) => (
                    <div key={i} className="timeline-item">
                        <div className="timeline-date">{ev.date.toLocaleDateString()}</div>
                        <div className="timeline-line">
                            <div className="timeline-dot"></div>
                            <div className="timeline-connector"></div>
                        </div>
                        <div className="timeline-content">
                            <h4>{ev.label}</h4>
                            <p>{ev.filename}</p>
                            <p className="text-mono text-xs" style={{marginTop: '2px', color: 'var(--text-subtle)'}}>{ev.raw}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderMap = () => {
        if (!results) return null;
        const gpsItems: any[] = [];
        
        results.forEach(r => {
            const meta = r.metadata || {};
            const latVal = meta.GPSLatitude || meta.Latitude || (r.gps && (r.gps.latitude || r.gps.GPSLatitude));
            const lonVal = meta.GPSLongitude || meta.Longitude || (r.gps && (r.gps.longitude || r.gps.GPSLongitude));
            
            if (latVal && lonVal) {
                const lat = parseFloat(String(latVal).replace(/[^0-9.-]/g, ''));
                const lon = parseFloat(String(lonVal).replace(/[^0-9.-]/g, ''));
                if (!isNaN(lat) && !isNaN(lon)) {
                    gpsItems.push({ lat, lon, filename: r.filename || r.name || 'Unknown', meta });
                }
            }
        });

        if (!gpsItems.length) {
            return (
                <div className="empty-state">
                    <h3>No GPS data found</h3>
                    <p>None of the analyzed files contained embedded GPS coordinates.</p>
                </div>
            );
        }

        return (
            <div>
                <p style={{color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px'}}>
                    Found GPS coordinates in <strong>{gpsItems.length}</strong> file(s).
                </p>
                {gpsItems.map((item, i) => {
                    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${item.lon - 0.01},${item.lat - 0.01},${item.lon + 0.01},${item.lat + 0.01}&layer=mapnik&marker=${item.lat},${item.lon}`;
                    const osmUrl = `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}&zoom=15`;
                    
                    return (
                        <div key={i} className="gps-card">
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap'}}>
                                <div>
                                    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px'}}>{item.filename}</div>
                                    <div className="gps-coords">{item.lat.toFixed(6)}°, {item.lon.toFixed(6)}°</div>
                                </div>
                                <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Open in OSM</a>
                            </div>
                            <div className="map-embed">
                                <iframe src={embedUrl} title={`Map location for ${item.filename}`} loading="lazy" allowFullScreen style={{width: '100%', height: '300px', border: 'none'}}></iframe>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="scan-page">
            <h1 className="page-title">Metadata Scanner</h1>
            <p className="page-subtitle">Upload files or enter a URL to extract hidden metadata.</p>

            <div className="mode-toggle" role="tablist">
                <button className={`mode-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => { setMode('file'); setResults(null); }}>File Upload</button>
                <button className={`mode-btn ${mode === 'url' ? 'active' : ''}`} onClick={() => { setMode('url'); setResults(null); }}>Web Scrape</button>
            </div>

            {mode === 'file' && (
                <div className="scan-panel">
                    <div className={`dropzone ${isDragging ? 'drag-over' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                        <p>Drop files here or <span>browse</span></p>
                    </div>
                    <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileChange} />
                    <div className="file-list">
                        {files.map((f, i) => (
                            <div key={i} className="file-item">
                                <span className="file-item-name">{f.name}</span>
                                <span className="file-item-size">{formatBytes(f.size)}</span>
                                <button className="file-item-remove" onClick={() => removeFile(i)}>X</button>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <button className="btn btn-primary" disabled={files.length === 0} onClick={handleAnalyze}>Analyze Files</button>
                    </div>
                </div>
            )}

            {mode === 'url' && (
                <div className="scan-panel">
                    <div className="input-group">
                        <label>Target URL</label>
                        <input type="url" className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://target.com/" />
                    </div>
                    <div className="scrape-options">
                        <label>Crawl depth: <input type="number" value={depth} onChange={e => setDepth(Number(e.target.value))} min="0" max="3" /></label>
                        <label><input type="checkbox" checked={scanOnly} onChange={e => setScanOnly(e.target.checked)} /> Scan only</label>
                    </div>
                    <button className="btn btn-primary" onClick={handleScrape}>Start Scraping</button>
                </div>
            )}

            {showProgress && (
                <div className="scan-progress">
                    <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }}></div></div>
                    <p>{progressLabel}</p>
                </div>
            )}

            {results && (
                <div id="results-panel">
                    <div className="results-header">
                        <h2>Results</h2>
                        <div className="export-buttons">
                            <button className="btn btn-secondary" onClick={handleExportJson}>JSON</button>
                        </div>
                    </div>
                    <div className="tabs">
                        <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
                        <button className={`tab ${activeTab === 'all-fields' ? 'active' : ''}`} onClick={() => setActiveTab('all-fields')}>All Fields</button>
                        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</button>
                        <button className={`tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>GPS & Map</button>
                    </div>
                    {activeTab === 'summary' && <div className="tab-content">{renderSummary()}</div>}
                    {activeTab === 'all-fields' && <div className="tab-content">{renderAllFields()}</div>}
                    {activeTab === 'timeline' && <div className="tab-content">{renderTimeline()}</div>}
                    {activeTab === 'map' && <div className="tab-content">{renderMap()}</div>}
                </div>
            )}
        </div>
    );
};

export default Scan;


