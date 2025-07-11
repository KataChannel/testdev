import { CONFIG } from './config';
import { InvoiceData, InvoiceDetail } from './database';

export class APIService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl: string = CONFIG.API.BASE_URL) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Invoice API methods
  async fetchInvoices(params: {
    invoiceType: string;
    fromDate: string;
    toDate: string;
    token: string;
    size?: number;
    sort?: string;
    state?: string;
  }): Promise<{ datas: InvoiceData[]; total: number; state?: string }> {
    const queryParams = new URLSearchParams({
      sort: params.sort || 'tdlap,desc',
      size: (params.size || CONFIG.UI.DEFAULT_PAGE_SIZE).toString(),
      search: `tdlap=ge=${params.fromDate};tdlap=le=${params.toDate}`,
    });

    if (params.state) {
      queryParams.append('state', params.state);
    }

    const endpoint = `/query/invoices/${params.invoiceType}?${queryParams}`;
    return this.request<{ datas: InvoiceData[]; total: number; state?: string }>(
      endpoint,
      { method: 'GET' },
      params.token
    );
  }

  async fetchInvoiceDetail(params: {
    nbmst: string;
    khhdon: string;
    shdon: string;
    khmshdon: string;
    token: string;
  }): Promise<InvoiceDetail> {
    const queryParams = new URLSearchParams({
      nbmst: params.nbmst,
      khhdon: params.khhdon,
      shdon: params.shdon,
      khmshdon: params.khmshdon,
    });

    const endpoint = `/query/invoices/detail?${queryParams}`;
    return this.request<InvoiceDetail>(endpoint, { method: 'GET' }, params.token);
  }

  // Call Center API methods
  async callCenterRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    config?: {
      baseUrl?: string;
      apiKey?: string;
    }
  ): Promise<T> {
    const url = `${config?.baseUrl || CONFIG.CALL_CENTER.BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>;

    if (config?.apiKey || CONFIG.CALL_CENTER.API_TOKEN) {
      headers['api-key'] = config?.apiKey || CONFIG.CALL_CENTER.API_TOKEN;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async fetchCallHistory(params: {
    domainName: string;
    from: string;
    to: string;
    limit?: number;
    offset?: number;
    callerIdNumber?: string;
    destinationNumber?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams({
      domain_name: params.domainName,
      from: params.from,
      to: params.to,
      limit: (params.limit || 20).toString(),
      offset: (params.offset || 0).toString(),
    });

    if (params.callerIdNumber) {
      queryParams.append('caller_id_number', params.callerIdNumber);
    }
    if (params.destinationNumber) {
      queryParams.append('destination_number', params.destinationNumber);
    }

    return this.callCenterRequest(`/api/v2/cdr?${queryParams}`, { method: 'GET' });
  }

  async fetchExtensionStatus(domainName: string): Promise<any> {
    return this.callCenterRequest(`/api/v2/extension_status?domain_name=${domainName}`, { method: 'GET' });
  }

  async fetchExtensionInfo(domainName: string): Promise<any> {
    return this.callCenterRequest(`/api/v2/extension?domain_name=${domainName}`, { method: 'GET' });
  }

  async clickToCall(params: {
    domainName: string;
    phone: string;
    extension: string;
    callerid?: string;
    record?: boolean;
  }): Promise<any> {
    const queryParams = new URLSearchParams({
      domain_name: params.domainName,
      phone: params.phone,
      extension: params.extension,
      callerid: params.callerid || '',
      record: (params.record || false).toString()
    });

    return this.callCenterRequest(`/api/v2/clicktocall?${queryParams}`, { method: 'GET' });
  }
}

export const apiService = new APIService();
