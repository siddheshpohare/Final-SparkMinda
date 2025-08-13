import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, ReferenceLine, Label } from 'recharts';
import { AlertTriangle, Wifi, WifiOff, TrendingUp, Upload, RefreshCw, X, Clock, Thermometer, RotateCcw, Gauge, Zap, AlertCircle, FileText } from 'lucide-react';
import infographics1 from './infographics1.png';

// A placeholder for the logo if the import fails
const FallbackLogo = () => (
    <div className="w-24 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-500">Logo</span>
    </div>
);

// Custom shape for violation markers on the chart
const ViolationMarker = ({ cx, cy }) => {
    // Renders a styled AlertTriangle icon at the violation's coordinates
    return (
        <g transform={`translate(${cx - 8}, ${cy - 8})`}>
            <AlertTriangle color="rgba(239, 68, 68, 0.8)" fill="rgba(239, 68, 68, 0.5)" size={16} strokeWidth={1} />
        </g>
    );
};

// This custom shape function decides whether to render a violation marker for a point
const ViolationShape = (props) => {
    const { payload } = props;
    if (payload.is_violation) {
        return <ViolationMarker {...props} />;
    }
    return null;
};

// This component renders a custom dot AND a label for specific points (like min/max)
const LabelledDot = ({ cx, cy, value }) => (
    <g>
        <circle cx={cx} cy={cy} r={6} stroke="rgba(0, 0, 0, 0.6)" strokeWidth={1} fill="#ffffff" />
        <circle cx={cx} cy={cy} r={3} fill="rgba(0, 0, 0, 0.8)" />
        <text x={cx} y={cy - 12} textAnchor="middle" fill="#333" fontSize="12" fontWeight="bold">
            {value}
        </text>
    </g>
);


// New Component for the Performance Chart
const PerformanceChart = ({ data, thresholds, parameter, parameters }) => {
    // Calculate the Y-axis domain based on the entire dataset to keep it stable
    const yDomain = useMemo(() => {
        const allValues = data.flatMap(p => [p.actual])
                              .filter(v => typeof v === 'number');
        if (allValues.length === 0) return [0, 100]; 
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const range = maxValue - minValue;
        const padding = range > 0 ? range * 0.1 : 20;
        return [Math.floor(minValue - padding), Math.ceil(maxValue + padding)];
    }, [data]);

    // Find the min/max points in the full data
    const minValue = useMemo(() => Math.min(...data.map(p => p.actual).filter(v => typeof v === 'number')), [data]);
    const maxValue = useMemo(() => Math.max(...data.map(p => p.actual).filter(v => typeof v === 'number')), [data]);
    const minPoint = data.find(p => p.actual === minValue);
    const maxPoint = data.find(p => p.actual === maxValue);
    const visibleMinMaxPoints = [minPoint, maxPoint].filter(Boolean);

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                    Performance - {parameters.find(p => p.value === parameter)?.label || 'Parameter'}
                </h3>
            </div>
            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="time" stroke="#6B7280" />
                        <YAxis
                            stroke="#6B7280"
                            domain={yDomain}
                            allowDataOverflow
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#F9FAFB',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                color: '#111827'
                            }}
                        />
                        <Legend />
                        <Line 
                            type="monotone" 
                            dataKey="actual" 
                            name="Actual" 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 6 }}
                            connectNulls={false} 
                        />
                        {thresholds.upper && <ReferenceLine y={thresholds.upper} stroke="#EF4444" strokeDasharray="3 3">
                            <Label value="Upper Std Spec" position="insideTopRight" fill="#EF4444" />
                        </ReferenceLine>}
                        {thresholds.lower && <ReferenceLine y={thresholds.lower} stroke="#FBBF24" strokeDasharray="3 3">
                             <Label value="Lower Std Spec" position="insideBottomRight" fill="#FBBF24" />
                        </ReferenceLine>}
                        <Scatter name="Violation" dataKey="actual" data={data} shape={ViolationShape} zIndex={100} />
                        <Scatter name="Min/Max" dataKey="actual" data={visibleMinMaxPoints} shape={LabelledDot} zIndex={101} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};


const SparkMindaDashboard = () => {
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Add logo error state here
    const [logoError, setLogoError] = useState(false);

    // Application state management
    const [appStatus, setAppStatus] = useState('initializing'); 
    const [statusMessage, setStatusMessage] = useState('Connecting to server...');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    // Data and selection states
    const [chartData, setChartData] = useState([]);
    const [machines, setMachines] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [availableFeatures, setAvailableFeatures] = useState([]);
    const [selectedMachine, setSelectedMachine] = useState('');
    const [selectedParameter, setSelectedParameter] = useState('metal_temperature');
    
    // File upload states
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    // --- Thresholds States ---
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
    
    // --- Static Definitions ---
    const parameters = useMemo(() => [
        { value: 'metal_temperature', label: 'Metal Temperature (°C)', icon: Thermometer },
        { value: 'solidification_time', label: 'Solidification Time (sec)', icon: Clock },
        { value: 'tilting_angle', label: 'Tilting Angle (°)', icon: RotateCcw },
        { value: 'tilting_speed', label: 'Tilting Speed (rpm)', icon: Gauge },
        { value: 'top_die_temperature', label: 'Top Die Temperature (°C)', icon: Zap }
    ], []);

    // --- API Fetching Functions ---
    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/alerts`);
            if (!response.ok) throw new Error('Failed to fetch alerts');
            const data = await response.json();
            if (data.success) setAlerts(data.alerts);
        } catch (error) {
            console.error("Fetch Alerts Error:", error);
            setAlerts([]);
        }
    }, [API_BASE_URL]);

    const fetchMetrics = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/metrics`);
            if (!response.ok) throw new Error('Failed to fetch metrics');
            const data = await response.json();
            if (data.success) setMetrics(data.metrics);
        } catch (error) {
            console.error("Fetch Metrics Error:", error);
            setMetrics(null);
        }
    }, [API_BASE_URL]);

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
                    setStatusMessage(machinesData.message || 'No data file found on server.');
                } else {
                    throw new Error(machinesData.message || 'Failed to fetch machine data.');
                }
            } else {
                setAppStatus('ready');
                const newMachines = machinesData.machines || [];
                setMachines(newMachines);

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

    const fetchChartData = useCallback(async () => {
        if (!selectedMachine || !selectedParameter) return;
        try {
            const response = await fetch(`${API_BASE_URL}/chart_data?machine=${selectedMachine}&parameter=${selectedParameter}`);
            if (!response.ok) throw new Error('Failed to fetch chart data');
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
            console.error("Fetch Chart Data Error:", error);
            setChartData([]);
        }
    }, [API_BASE_URL, selectedMachine, selectedParameter]);

    // --- User Action Handlers ---
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setUploadStatus('');
        }
    };

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

    const dismissAlert = (alertId) => {
        setAlerts(currentAlerts => currentAlerts.filter(alert => alert.id !== alertId));
    };

    // --- Threshold Logic ---
    const getCurrentThreshold = useCallback(() => {
        switch(selectedParameter) {
            case 'metal_temperature': return { upper: metalTempThreshold, lower: metalTempLowerThreshold };
            case 'solidification_time': return { upper: solidificationTimeThreshold, lower: solidificationTimeLowerThreshold };
            case 'tilting_angle': return { upper: tiltingAngleThreshold, lower: tiltingAngleLowerThreshold };
            case 'tilting_speed': return { upper: tiltingSpeedThreshold, lower: tiltingSpeedLowerThreshold };
            case 'top_die_temperature': return { upper: topDieTempThreshold, lower: topDieTempLowerThreshold };
            default: return { upper: undefined, lower: undefined };
        }
    }, [selectedParameter, metalTempThreshold, metalTempLowerThreshold, solidificationTimeThreshold, solidificationTimeLowerThreshold, tiltingAngleThreshold, tiltingAngleLowerThreshold, tiltingSpeedThreshold, tiltingSpeedLowerThreshold, topDieTempThreshold, topDieTempLowerThreshold]);

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

    // --- Effects ---
    useEffect(() => {
        fetchInitialData(false);
        const interval = setInterval(() => {
            if(isConnected) {
                fetchAlerts();
                fetchMetrics();
            }
        }, 30000); 
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (appStatus === 'ready' && selectedMachine) {
            fetchChartData();
        }
    }, [appStatus, selectedMachine, selectedParameter, fetchChartData]);

    // --- Memoized Data Processing ---
    const processedChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        // Use selectedParameter instead of undefined variable 'parameter'
        return chartData.map(point => ({
            time: point.time,
            actual: point[selectedParameter], // Always show actual value
            is_violation: point.is_violation || false,
        }));
    }, [chartData, selectedParameter]);

    const selectedMachineMetrics = metrics && metrics[selectedMachine] ? metrics[selectedMachine] : null;

    // --- UI Components ---
    const Header = () => (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {!logoError ? (
                            <img 
                                src={infographics1} 
                                alt="SparkMinda Logo" 
                                className="w-24 h-12 rounded-lg object-contain"
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <FallbackLogo />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">SparkMinda</h1>
                            <p className="text-sm text-gray-500">LSTM-Powered Machine Monitor</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                            <span className={`text-sm font-semibold ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
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

    const UploadSection = () => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-gray-600" />
                <span>Data Management</span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload New Data File of single machine(.xlsx, .xls, .csv)
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
                            <span>{isUploading ? 'Uploading...' : 'Upload & Train'}</span>
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
                        {!uploadStatus && <p className="text-sm text-gray-400">Select a file and click Upload(single machine data at a time).</p>}
                    </div>
                </div>
            </div>
        </div>
    );

    const DashboardView = () => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Downtime Incidents</h3>
                        <Clock className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-500">{selectedMachineMetrics?.idle_time_violations ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine'}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Die Temp Violations</h3>
                        <Thermometer className="w-5 h-5 text-yellow-500" />
                    </div>
                    <p className="text-3xl font-bold text-yellow-500">{selectedMachineMetrics?.temperature_violations ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine'}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">Total Strokes</h3>
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-500">{selectedMachineMetrics?.total_strokes ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">{selectedMachine || 'No Machine'}</p>
                </div>
            </div>

            {/* --- Control Panel --- */}
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
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">Standard Specifications Control</h3>
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

            <PerformanceChart 
                data={processedChartData}
                thresholds={getCurrentThreshold()}
                parameter={selectedParameter}
                parameters={parameters}
            />

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
                                            Standard Specification: <span className="font-semibold text-gray-800">{alert.threshold}</span> | 
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
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
            <Header />
            <main className="container mx-auto px-6 py-8">
                {appStatus === 'initializing' && <div className="text-center p-10 font-semibold">Loading Dashboard...</div>}
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
