import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts';
import { AlertTriangle, Wifi, WifiOff, TrendingUp, Upload, RefreshCw, X, Activity, Thermometer, Clock, RotateCcw, Gauge, Zap, AlertCircle, FileText } from 'lucide-react';
import infographics1 from './infographics1.png'; // Make sure the path is correct

// Custom shape for violation markers on the chart
const ViolationMarker = ({ cx, cy }) => {
    // Renders a styled AlertTriangle icon at the violation's coordinates
    return (
        <g transform={`translate(${cx - 8}, ${cy - 8})`}>
            <AlertTriangle color="rgba(239, 68, 68, 0.8)" fill="rgba(239, 68, 68, 0.5)" size={16} strokeWidth={1} />
        </g>
    );
};

const SparkMindaDashboard = () => {
    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    
    const [appStatus, setAppStatus] = useState('initializing'); 
    const [statusMessage, setStatusMessage] = useState('Connecting to server...');

    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    
    const [chartData, setChartData] = useState([]); // Will hold historical + prediction
    const [machines, setMachines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [availableFeatures, setAvailableFeatures] = useState([]);

    const [selectedMachine, setSelectedMachine] = useState('');
    const [selectedParameter, setSelectedParameter] = useState('metal_temperature');
    const [timeRange, setTimeRange] = useState('24hr');

    // Thresholds states...
    const [metalTempThreshold, setMetalTempThreshold] = useState(730);
    const [metalTempLowerThreshold, setMetalTempLowerThreshold] = useState(710);
    const [solidificationTimeThreshold, setSolidificationTimeThreshold] = useState(180);
    const [solidificationTimeLowerThreshold, setSolidificationTimeLowerThreshold] = useState(180);
    const [tiltingAngleThreshold, setTiltingAngleThreshold] = useState(90);
    const [tiltingAngleLowerThreshold, setTiltingAngleLowerThreshold] = useState(90);
    const [tiltingSpeedThreshold, setTiltingSpeedThreshold] = useState(8);
    const [tiltingSpeedLowerThreshold, setTiltingSpeedLowerThreshold] = useState(6);
    const [topDieTempThreshold, setTopDieTempThreshold] = useState(380);
    const [topDieTempLowerThreshold, setTopDieTempLowerThreshold] = useState(300);

    const parameters = [
        { value: 'metal_temperature', label: 'Metal Temperature (°C)', icon: Thermometer },
        { value: 'solidification_time', label: 'Solidification Time (sec)', icon: Clock },
        { value: 'tilting_angle', label: 'Tilting Angle (°)', icon: RotateCcw },
        { value: 'tilting_speed', label: 'Tilting Speed (rpm)', icon: Gauge },
        { value: 'top_die_temperature', label: 'Top Die Temperature (°C)', icon: Zap }
    ];

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setUploadStatus('');
        }
    };

    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/alerts`);
            const data = await response.json();
            if (data.success) setAlerts(data.alerts);
        } catch (error) {
            setAlerts([]);
        }
    }, [API_BASE_URL]);

    const fetchMetrics = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/metrics`);
            const data = await response.json();
            if (data.success) setMetrics(data.metrics);
        } catch (error) {
            setMetrics(null);
        }
    }, [API_BASE_URL]);

    // **FIXED**: This function now correctly updates the selected machine after a data change.
    const fetchInitialData = useCallback(async (isAfterUpload = false) => {
        setIsLoading(true);
        try {
            const healthResponse = await fetch(`${API_BASE_URL}/health`);
            if (!healthResponse.ok) throw new Error("API is not reachable.");
            setIsConnected(true);

            const machinesResponse = await fetch(`${API_BASE_URL}/machines`);
            const machinesData = await machinesResponse.json();

            if (!machinesResponse.ok) {
                if (machinesData.code === 'NO_DATA_FILE') {
                    setAppStatus('no_data');
                    setStatusMessage(machinesData.message);
                } else {
                    throw new Error(machinesData.message || 'Failed to fetch machine data.');
                }
            } else {
                setAppStatus('ready');
                const newMachines = machinesData.machines || [];
                setMachines(newMachines);

                // If it's after an upload or the current selection is invalid, reset to the first machine.
                if (newMachines.length > 0) {
                    const currentMachineIsValid = selectedMachine && newMachines.includes(selectedMachine);
                    if (isAfterUpload || !currentMachineIsValid) {
                        setSelectedMachine(newMachines[0]);
                    }
                } else {
                    setSelectedMachine('');
                }
                
                await Promise.all([fetchAlerts(), fetchMetrics()]);
            }
        } catch (error) {
            setAppStatus('error');
            setStatusMessage(error.message);
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL, fetchAlerts, fetchMetrics, selectedMachine]);


    const uploadFile = async () => {
        if (!selectedFile) {
            setUploadStatus('Please select a file first');
            return;
        }
        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus('Uploading & Training Model...');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('auto_train', 'true');

            const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            const result = await response.json();
            
            if (response.ok && result.success) {
                setUploadStatus(result.auto_train_status?.message || 'File processed successfully!');
                // **FIXED**: Call fetchInitialData with a flag to indicate it's after an upload.
                await fetchInitialData(true);
            } else {
                setUploadStatus(result.message || 'Upload failed');
            }
        } catch (error) {
            setUploadStatus('Upload failed: ' + error.message);
        } finally {
            setIsUploading(false);
            setUploadProgress(100);
        }
    };

    const fetchChartData = useCallback(async () => {
        if (!selectedMachine || !selectedParameter) return;
        try {
            const response = await fetch(`${API_BASE_URL}/chart_data?range=${timeRange}&machine=${selectedMachine}&parameter=${selectedParameter}`);
            const data = await response.json();
            if (data.success) {
                setChartData(data.data);
                if (data.feature_columns) {
                    setAvailableFeatures(data.feature_columns);
                    if (!data.feature_columns.includes(selectedParameter)){
                        setSelectedParameter(data.feature_columns[0] || '');
                    }
                }
            } else {
                 setChartData([]);
            }
        } catch (error) {
            setChartData([]);
        }
    }, [API_BASE_URL, selectedMachine, selectedParameter, timeRange]);

    
    // Initial data load and polling
    useEffect(() => {
        fetchInitialData(false);
        const interval = setInterval(() => {
            fetchAlerts();
            fetchMetrics();
        }, 30000); 
        return () => clearInterval(interval);
    }, []); // Removed dependencies to run only once on mount

    // Effect for fetching chart data when selections change
    useEffect(() => {
        if (appStatus === 'ready' && selectedMachine) {
            fetchChartData();
        }
    }, [appStatus, selectedMachine, fetchChartData]);


    const trainModel = async () => {
        setUploadStatus('Training model...');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/train`, { method: 'POST' });
            const data = await response.json();
            setUploadStatus(data.message || 'Request completed.');
            if (data.success) {
                await fetchInitialData(true); 
            }
        } catch (error) {
            setUploadStatus('Failed to train model.');
        } finally {
            setIsLoading(false);
            setTimeout(() => setUploadStatus(''), 5000);
        }
    };
    
    const processedChartData = useMemo(() => {
        return chartData.map(point => ({
            ...point,
            time: point.time,
            actual: point[selectedParameter], // Use 'actual' for the value
        }));
    }, [chartData, selectedParameter]);

    const violationData = useMemo(() => 
        processedChartData.filter(d => d.is_violation), 
        [processedChartData]
    );

    const dismissAlert = (alertId) => {
        setAlerts(currentAlerts => currentAlerts.filter(alert => alert.id !== alertId));
    };

    const getCurrentThreshold = () => {
        switch(selectedParameter) {
            case 'metal_temperature': return { upper: metalTempThreshold, lower: metalTempLowerThreshold };
            case 'solidification_time': return { upper: solidificationTimeThreshold, lower: solidificationTimeLowerThreshold };
            case 'tilting_angle': return { upper: tiltingAngleThreshold, lower: tiltingAngleLowerThreshold };
            case 'tilting_speed': return { upper: tiltingSpeedThreshold, lower: tiltingSpeedLowerThreshold };
            case 'top_die_temperature': return { upper: topDieTempThreshold, lower: topDieTempLowerThreshold };
            default: return { upper: undefined, lower: undefined };
        }
    };

    const updateThreshold = (type, value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) return;

        switch(selectedParameter) {
            case 'metal_temperature': type === 'upper' ? setMetalTempThreshold(numValue) : setMetalTempLowerThreshold(numValue); break;
            case 'solidification_time': type === 'upper' ? setSolidificationTimeThreshold(numValue) : setSolidificationTimeLowerThreshold(numValue); break;
            case 'tilting_angle': type === 'upper' ? setTiltingAngleThreshold(numValue) : setTiltingAngleLowerThreshold(numValue); break;
            case 'tilting_speed': type === 'upper' ? setTiltingSpeedThreshold(numValue) : setTiltingSpeedLowerThreshold(numValue); break;
            case 'top_die_temperature': type === 'upper' ? setTopDieTempThreshold(numValue) : setTopDieTempLowerThreshold(numValue); break;
            default: break;
        }
    };

    const selectedMachineMetrics = metrics && metrics[selectedMachine] ? metrics[selectedMachine] : null;

    // --- UI Components ---
    const Header = () => (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <img src={infographics1} alt="SparkMinda Logo" className="w-24 h-12 rounded-lg" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                SparkMinda
                            </h1>
                            <p className="text-sm text-gray-500">LSTM-Powered Machine Monitor</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                            <span className={`text-sm ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
                                {isConnected ? 'API Connected' : 'API Disconnected'}
                            </span>
                        </div>
                        <button
                            onClick={trainModel}
                            disabled={!isConnected || isLoading}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 text-sm flex items-center space-x-2">
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>{isLoading ? 'Working...' : 'Force Retrain'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );

    // **FIXED**: This component now clearly shows the selected file name.
    const UploadSection = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-gray-600" />
                <span>Data Management</span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload New Data File of single machine (.xlsx, .xls, .csv)
                    </label>
                    <div className="flex items-center space-x-4">
                         <label htmlFor="file-upload" className="cursor-pointer px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors">
                            Choose File
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {selectedFile && (
                            <div className="flex items-center space-x-2 text-sm text-gray-700">
                                <FileText className="w-4 h-4 text-gray-600" />
                                <span>{selectedFile.name}</span>
                            </div>
                        )}
                         <button
                            onClick={uploadFile}
                            disabled={!selectedFile || isUploading || !isConnected}
                            className="ml-auto px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors flex items-center space-x-2">
                            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Process Status
                    </label>
                    <div className="bg-gray-100 rounded-lg p-4 min-h-[88px] flex flex-col justify-center">
                        {uploadStatus && (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">{uploadStatus}</p>
                                {uploadProgress > 0 && (
                                    <div className="w-full bg-gray-300 rounded-full h-2">
                                        <div 
                                            className="bg-gray-800 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!uploadStatus && <p className="text-sm text-gray-400">Select a file of single machine and click Upload.</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const DashboardView = () => (
        <>
            {/* Metrics Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Downtime incidents(greater than 10 min)</h3>
                        <Clock className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-500">{selectedMachineMetrics?.idle_time_violations ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine Selected'}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Die Temp Violations</h3>
                        <Thermometer className="w-5 h-5 text-yellow-500" />
                    </div>
                    <p className="text-3xl font-bold text-yellow-500">{selectedMachineMetrics?.temperature_violations ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine Selected'}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Total Strokes</h3>
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-500">{selectedMachineMetrics?.total_strokes ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine Selected'}</p>
                </div>
            </div>

            {/* Control Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Machine</h3>
                    <div className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-800">
                        {selectedMachine || 'No Machine Selected'}
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Parameter Selection</h3>
                    <select 
                        value={selectedParameter} 
                        onChange={(e) => setSelectedParameter(e.target.value)}
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-gray-400">
                        {parameters
                            .filter(p => availableFeatures.includes(p.value))
                            .map(param => (
                                <option key={param.value} value={param.value}>{param.label}</option>
                        ))}
                        {availableFeatures.length === 0 && <option>No features available</option>}
                    </select>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Standard Specifications control</h3>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={getCurrentThreshold().lower ?? ''}
                            onChange={(e) => updateThreshold('lower', e.target.value)}
                            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-gray-400"
                            placeholder="Lower"
                        />
                        <input
                            type="number"
                            value={getCurrentThreshold().upper ?? ''}
                            onChange={(e) => updateThreshold('upper', e.target.value)}
                            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-gray-400"
                            placeholder="Upper"
                        />
                    </div>
                </div>
            </div>

            {/* Main Chart with Time Range Controls */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800">
                        Performance - {parameters.find(p => p.value === selectedParameter)?.label || 'Parameter'}
                    </h3>
                    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
                        {['1hr', '6hr', '24hr'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                                    timeRange === range 
                                    ? 'bg-gray-800 text-white' 
                                    : 'text-gray-600 hover:bg-gray-200'
                                }`}>
                                {range.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={processedChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="time" stroke="#6B7280" />
                            <YAxis stroke="#6B7280" domain={['dataMin - 10', 'dataMax + 10']} allowDataOverflow />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#F9FAFB', 
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px',
                                    color: '#111827'
                                }} 
                            />
                            <Legend />
                            <Line type="monotone" dataKey="actual" stroke="#6366F1" strokeWidth={2} dot={false} name="Actual Value" connectNulls={false} />
                            <Line type="monotone" dataKey={() => getCurrentThreshold().upper} stroke="#EF4444" strokeDasharray="5 5" dot={false} name="Upper std specification" />
                            <Line type="monotone" dataKey={() => getCurrentThreshold().lower} stroke="#FBBF24" strokeDasharray="5 5" dot={false} name="Lower std specification" />
                            <Scatter name="Violation" dataKey="actual" data={violationData} fill="#EF4444" shape={<ViolationMarker />} zIndex={100} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Alerts Panel */}
            {alerts.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-red-200">
                    <h3 className="text-xl font-semibold mb-6 text-red-600">Active & Recent Alerts</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {alerts.map((alert) => (
                            <div key={alert.id} className={`bg-gray-100 rounded-lg p-4 flex items-center justify-between border-l-4 ${alert.severity === 'high' ? 'border-red-500' : 'border-yellow-500'}`}>
                                <div className="flex items-center space-x-3">
                                    <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${alert.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
                                    <div>
                                        <p className="font-medium text-gray-800">
                                            {alert.machine}: <span className="font-normal">{alert.parameter} out of range</span>
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Value: <span className="font-semibold text-gray-800">{alert.value}</span> | 
                                            Threshold: <span className="font-semibold text-gray-800">{alert.threshold}</span> | 
                                            Time: <span className="font-semibold text-gray-800">{alert.time}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => dismissAlert(alert.id)}>
                                    <X className="w-4 h-4 text-gray-400 hover:text-gray-800" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const StatusView = ({ status, message }) => (
        <div className="text-center p-10 bg-white rounded-xl border border-yellow-200">
            <AlertCircle className="mx-auto w-12 h-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold text-yellow-600">
                {status === 'no_data' ? 'Awaiting Data' : 'An Error Occurred'}
            </h2>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">{message}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 text-gray-800 font-sans">
            <Header />
            <main className="container mx-auto px-6 py-8">
                {appStatus === 'initializing' && <div className="text-center p-10">Loading Dashboard...</div>}
                {appStatus !== 'initializing' && <UploadSection />}
                {appStatus === 'ready' && <DashboardView />}
                {(appStatus === 'no_data' || appStatus === 'error') && (
                    <StatusView status={appStatus} message={statusMessage} />
                )}
            </main>
        </div>
    );
};

export default SparkMindaDashboard;