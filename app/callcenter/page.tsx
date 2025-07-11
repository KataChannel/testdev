'use client';
import React, { useState, useEffect } from 'react';
interface CallRecord {
  uuid: string;
  domain_name: string;
  direction: 'inbound' | 'outbound' | 'local';
  caller_id_number: string;
  outbound_caller_id_number?: string;
  destination_number: string;
  start_stamp: string;
  answer_stamp?: string;
  end_stamp: string;
  duration: string;
  billsec: string;
  sip_hangup_disposition: string;
  record_path?: string;
  phonenumber: string;
  call_status: 'ANSWERED' | 'VOICEMAIL' | 'MISSED' | 'CANCELED' | 'FAILED' | 'UNKNOWN';
}

interface Extension {
  extension: string;
  domain: string;
  status: string | null;
  network: string | null;
  ping: string | null;
  agent: string | null;
}

interface ExtensionInfo {
  extension: string;
  password: string;
  outbound_caller_id_number: string;
  user_record: string;
  enabled: string;
}

interface CallCenter {
  baseUrl: string;
  apiKey: string;
  domainName: string;
}

interface WebhookData {
  caller: string;
  extension: string;
  created_at: string;
}

interface WebhookPayload {
  data: WebhookData;
  channel_state: 'RING' | 'ANSWER';
}

export default function CallCenterPage() {
  const [config, setConfig] = useState<CallCenter>({
    baseUrl: '',
    apiKey: '',
    domainName:  ''
  });  
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'extensions' | 'call' | 'webhook'>('history');
  
  // Call history filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [callerFilter, setCallerFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  
  // Click to call
  const [clickToCallData, setClickToCallData] = useState({
    phone: '',
    extension: '',
    callerid: '',
    record: false
  });
  
  // Webhook simulation
  const [webhookData, setWebhookData] = useState<WebhookPayload>({
    data: {
      caller: '',
      extension: '',
      created_at: ''
    },
    channel_state: 'RING'
  });

  // Set default dates (last 30 days)
  useEffect(() => {
    setConfig({
      baseUrl: process.env.NEXT_PUBLIC_CALL_CENTER_API_URL || '',
      apiKey: process.env.NEXT_PUBLIC_CALL_CENTER_API_TOKEN || '',
      domainName: process.env.NEXT_PUBLIC_CALL_CENTER_API_DOMAIN || ''
    });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    setDateFrom(thirtyDaysAgo.toISOString().slice(0, 16));
    setDateTo(now.toISOString().slice(0, 16));
  }, []);

  const fetchCallHistory = async () => {
    if (!config.baseUrl || !config.apiKey || !config.domainName) {
      setError('Vui lòng cấu hình API trước');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        domain_name: config.domainName,
        from: dateFrom.replace('T', ' ') + ':00',
        to: dateTo.replace('T', ' ') + ':00',
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (callerFilter) params.append('caller_id_number', callerFilter);
      if (destinationFilter) params.append('destination_number', destinationFilter);

      const response = await fetch(`${config.baseUrl}/api/v2/cdr?${params}`, {
        headers: {
          'api-key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCallHistory(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải lịch sử cuộc gọi');
    } finally {
      setLoading(false);
    }
  };

  const fetchExtensionStatus = async () => {
    if (!config.baseUrl || !config.apiKey || !config.domainName) {
      setError('Vui lòng cấu hình API trước');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.baseUrl}/api/v2/extension_status?domain_name=${config.domainName}`, {
        headers: {
          'api-key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExtensions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải trạng thái máy nhánh');
    } finally {
      setLoading(false);
    }
  };

  const fetchExtensionInfo = async () => {
    if (!config.baseUrl || !config.apiKey || !config.domainName) {
      setError('Vui lòng cấu hình API trước');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.baseUrl}/api/v2/extension?domain_name=${config.domainName}`, {
        headers: {
          'api-key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExtensionInfo(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải thông tin máy nhánh');
    } finally {
      setLoading(false);
    }
  };

  const handleClickToCall = async () => {
    if (!config.baseUrl || !config.apiKey || !config.domainName) {
      setError('Vui lòng cấu hình API trước');
      return;
    }

    if (!clickToCallData.phone || !clickToCallData.extension) {
      setError('Vui lòng nhập số điện thoại và máy nhánh');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        domain_name: config.domainName,
        phone: clickToCallData.phone,
        extension: clickToCallData.extension,
        callerid: clickToCallData.callerid || '',
        record: clickToCallData.record.toString()
      });

      const response = await fetch(`${config.baseUrl}/api/v2/clicktocall?${params}`, {
        headers: {
          'api-key': config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      alert(`Cuộc gọi đã được khởi tạo. UUID: ${data.uuid || 'N/A'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi thực hiện cuộc gọi');
    } finally {
      setLoading(false);
    }
  };

  const downloadRecording = async (recordPath: string) => {
    if (!config.baseUrl || !config.apiKey || !config.domainName || !recordPath) {
      return;
    }

    try {
      const params = new URLSearchParams({
        domain_name: config.domainName,
        record_path: recordPath
      });

      const response = await fetch(`${config.baseUrl}/api/v2/record?${params}`, {
        headers: {
          'api-key': config.apiKey
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = recordPath.split('/').pop() || 'recording.mp3';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error downloading recording:', err);
    }
  };

  const playRecording = (recordPath: string) => {
    if (!config.baseUrl || !recordPath) return;
    
    const playUrl = `${config.baseUrl}/recordings${recordPath}`;
    window.open(playUrl, '_blank');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds: string) => {
    const sec = parseInt(seconds);
    if (isNaN(sec)) return '0:00';
    const minutes = Math.floor(sec / 60);
    const remainingSeconds = sec % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ANSWERED': return 'text-green-600';
      case 'MISSED': return 'text-red-600';
      case 'CANCELED': return 'text-yellow-600';
      case 'FAILED': return 'text-red-800';
      default: return 'text-gray-600';
    }
  };

  const simulateWebhook = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const updatedWebhookData = {
      ...webhookData,
      data: {
        ...webhookData.data,
        created_at: now
      }
    };
    
    console.log('Webhook simulated:', updatedWebhookData);
    alert('Webhook đã được mô phỏng (xem console)');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">Quản lý tổng đài</h1>

      {/* API Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Cấu hình API</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Base URL</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Your API Key"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Domain Name</label>
            <input
              type="text"
              value={config.domainName}
              onChange={(e) => setConfig(prev => ({ ...prev, domainName: e.target.value }))}
              placeholder="demo"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'history', label: 'Lịch sử cuộc gọi' },
            { key: 'extensions', label: 'Máy nhánh' },
            { key: 'call', label: 'Thực hiện gọi' },
            { key: 'webhook', label: 'Webhook' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'history' | 'extensions' | 'call' | 'webhook')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Call History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Lịch sử cuộc gọi</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Từ ngày</label>
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Đến ngày</label>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Số gọi</label>
                <input
                  type="text"
                  value={callerFilter}
                  onChange={(e) => setCallerFilter(e.target.value)}
                  placeholder="Số điện thoại"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Số nhận</label>
                <input
                  type="text"
                  value={destinationFilter}
                  onChange={(e) => setDestinationFilter(e.target.value)}
                  placeholder="Số điện thoại"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Limit</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Offset</label>
                <input
                  type="number"
                  value={offset}
                  onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
                  className="px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <button
              onClick={fetchCallHistory}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Đang tải...' : 'Tải lịch sử cuộc gọi'}
            </button>
          </div>

          {/* Call History Table */}
          {callHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hướng gọi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Số gọi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Số nhận
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thời gian
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thời lượng
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ghi âm
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {callHistory.map((call) => (
                      <tr key={call.uuid}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            call.direction === 'inbound' ? 'bg-green-100 text-green-800' :
                            call.direction === 'outbound' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {call.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {call.caller_id_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {call.destination_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(call.start_stamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(call.duration)} / {formatDuration(call.billsec)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={getStatusColor(call.call_status)}>
                            {call.call_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {call.record_path && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => playRecording(call.record_path!)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Phát"
                              >
                                ▶️
                              </button>
                              <button
                                onClick={() => downloadRecording(call.record_path!)}
                                className="text-green-600 hover:text-green-800"
                                title="Tải về"
                              >
                                ⬇️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extensions Tab */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Trạng thái máy nhánh</h2>
            <div className="flex space-x-4">
              <button
                onClick={fetchExtensionStatus}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Đang tải...' : 'Tải trạng thái'}
              </button>
              <button
                onClick={fetchExtensionInfo}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Đang tải...' : 'Tải thông tin'}
              </button>
            </div>
          </div>

          {/* Extension Status */}
          {extensions.length > 0 && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Trạng thái máy nhánh</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Extension</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ping</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {extensions.map((ext) => (
                      <tr key={ext.extension}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{ext.extension}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            ext.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {ext.status || 'Offline'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{ext.network || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`${ext.ping === 'Reachable' ? 'text-green-600' : 'text-red-600'}`}>
                            {ext.ping || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{ext.agent || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Extension Info */}
          {extensionInfo.length > 0 && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Thông tin máy nhánh</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Extension</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Caller ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Record</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enabled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {extensionInfo.map((info) => (
                      <tr key={info.extension}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{info.extension}</td>
                        <td className="px-6 py-4 whitespace-nowrap">***</td>
                        <td className="px-6 py-4 whitespace-nowrap">{info.outbound_caller_id_number || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{info.user_record}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            info.enabled === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {info.enabled === 'true' ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Click to Call Tab */}
      {activeTab === 'call' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Thực hiện cuộc gọi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Số điện thoại</label>
              <input
                type="text"
                value={clickToCallData.phone}
                onChange={(e) => setClickToCallData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0977051367"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Extension</label>
              <input
                type="text"
                value={clickToCallData.extension}
                onChange={(e) => setClickToCallData(prev => ({ ...prev, extension: e.target.value }))}
                placeholder="101"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Caller ID</label>
              <input
                type="text"
                value={clickToCallData.callerid}
                onChange={(e) => setClickToCallData(prev => ({ ...prev, callerid: e.target.value }))}
                placeholder="842871001100"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="record"
                checked={clickToCallData.record}
                onChange={(e) => setClickToCallData(prev => ({ ...prev, record: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="record" className="text-sm font-medium">Ghi âm cuộc gọi</label>
            </div>
          </div>
          <button
            onClick={handleClickToCall}
            disabled={loading}
            className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Đang gọi...' : 'Thực hiện cuộc gọi'}
          </button>
        </div>
      )}

      {/* Webhook Tab */}
      {activeTab === 'webhook' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Mô phỏng Webhook</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Caller</label>
                <input
                  type="text"
                  value={webhookData.data.caller}
                  onChange={(e) => setWebhookData(prev => ({
                    ...prev,
                    data: { ...prev.data, caller: e.target.value }
                  }))}
                  placeholder="0977051367"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Extension</label>
                <input
                  type="text"
                  value={webhookData.data.extension}
                  onChange={(e) => setWebhookData(prev => ({
                    ...prev,
                    data: { ...prev.data, extension: e.target.value }
                  }))}
                  placeholder="1001"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Channel State</label>
                <select
                  value={webhookData.channel_state}
                  onChange={(e) => setWebhookData(prev => ({
                    ...prev,
                    channel_state: e.target.value as 'RING' | 'ANSWER'
                  }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="RING">RING</option>
                  <option value="ANSWER">ANSWER</option>
                </select>
              </div>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-md">
              <h3 className="font-semibold mb-2">JSON Payload:</h3>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(webhookData, null, 2)}
              </pre>
            </div>
            
            <button
              onClick={simulateWebhook}
              className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600"
            >
              Mô phỏng Webhook
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
