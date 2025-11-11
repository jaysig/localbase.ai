/**
 * Pre-configured chart templates for common visualization patterns
 * Based on the successful business-metrics.html implementation
 */

export const CHART_CONFIGS = {
  /**
   * Business Funnel Chart Configuration
   * Perfect for tracking business metrics with revenue on dual y-axis
   */
  businessFunnel: {
    title: 'Business Funnel Metrics',
    apiEndpoint: '/api/business-funnel',
    series: [
      { name: 'New Leads', field: 'newLeads', yAxis: 0 },
      { name: 'Appointments Set', field: 'appointments', yAxis: 0 },
      { name: 'Proposals Sent', field: 'proposalsSent', yAxis: 0 },
      { name: 'Proposals Signed', field: 'proposalsSigned', yAxis: 0 },
      { name: 'Revenue Collected', field: 'revenue', yAxis: 1, tooltipFormatter: (val) => `$${Math.round(val).toLocaleString()}` }
    ],
    colors: ["#ffc107", "#f25022", "#1877f2", "#9c27b0", "#34a853"],
    yAxis: {
      left: {
        title: "Count",
        series: ["New Leads", "Appointments Set", "Proposals Sent", "Proposals Signed"]
      },
      right: {
        title: "Revenue ($)",
        series: ["Revenue Collected"],
        formatter: (val) => '$' + Math.round(val).toLocaleString()
      }
    }
  },

  /**
   * Sales Pipeline Chart Configuration
   * For tracking deals through various stages
   */
  salesPipeline: {
    title: 'Sales Pipeline Metrics',
    series: [
      { name: 'Qualified Leads', field: 'qualifiedLeads', yAxis: 0 },
      { name: 'Opportunities', field: 'opportunities', yAxis: 0 },
      { name: 'Proposals', field: 'proposals', yAxis: 0 },
      { name: 'Closed Won', field: 'closedWon', yAxis: 0 },
      { name: 'Deal Value', field: 'dealValue', yAxis: 1, tooltipFormatter: (val) => `$${Math.round(val).toLocaleString()}` }
    ],
    colors: ["#ff6b35", "#004e92", "#009ffd", "#00d2ff", "#2ed573"],
    yAxis: {
      left: {
        title: "Deal Count",
        series: ["Qualified Leads", "Opportunities", "Proposals", "Closed Won"]
      },
      right: {
        title: "Value ($)",
        series: ["Deal Value"],
        formatter: (val) => '$' + Math.round(val).toLocaleString()
      }
    }
  },

  /**
   * Marketing Metrics Configuration
   * For tracking marketing activities and conversions
   */
  marketingMetrics: {
    title: 'Marketing Performance',
    series: [
      { name: 'Website Visitors', field: 'visitors', yAxis: 0 },
      { name: 'Leads Generated', field: 'leads', yAxis: 0 },
      { name: 'Email Opens', field: 'emailOpens', yAxis: 0 },
      { name: 'Conversions', field: 'conversions', yAxis: 0 },
      { name: 'Ad Spend', field: 'adSpend', yAxis: 1, tooltipFormatter: (val) => `$${Math.round(val).toLocaleString()}` }
    ],
    colors: ["#667eea", "#764ba2", "#f093fb", "#f5576c", "#4facfe"],
    yAxis: {
      left: {
        title: "Activity Count",
        series: ["Website Visitors", "Leads Generated", "Email Opens", "Conversions"]
      },
      right: {
        title: "Spend ($)",
        series: ["Ad Spend"],
        formatter: (val) => '$' + Math.round(val).toLocaleString()
      }
    }
  },

  /**
   * Customer Success Metrics
   * For tracking customer lifecycle and retention
   */
  customerSuccess: {
    title: 'Customer Success Metrics',
    series: [
      { name: 'New Customers', field: 'newCustomers', yAxis: 0 },
      { name: 'Active Users', field: 'activeUsers', yAxis: 0 },
      { name: 'Support Tickets', field: 'supportTickets', yAxis: 0 },
      { name: 'Churn', field: 'churn', yAxis: 0 },
      { name: 'MRR', field: 'mrr', yAxis: 1, tooltipFormatter: (val) => `$${Math.round(val).toLocaleString()}` }
    ],
    colors: ["#43cea2", "#185a9d", "#f093fb", "#f5576c", "#4facfe"],
    yAxis: {
      left: {
        title: "Customer Count",
        series: ["New Customers", "Active Users", "Support Tickets", "Churn"]
      },
      right: {
        title: "Revenue ($)",
        series: ["MRR"],
        formatter: (val) => '$' + Math.round(val).toLocaleString()
      }
    }
  },

  /**
   * Simple Multi-Line Chart (no dual y-axis)
   * For basic trend analysis
   */
  simpleTrends: {
    title: 'Trend Analysis',
    series: [
      { name: 'Metric 1', field: 'metric1', yAxis: 0 },
      { name: 'Metric 2', field: 'metric2', yAxis: 0 },
      { name: 'Metric 3', field: 'metric3', yAxis: 0 },
      { name: 'Metric 4', field: 'metric4', yAxis: 0 }
    ],
    colors: ["#ffc107", "#f25022", "#1877f2", "#34a853"],
    yAxis: {
      left: {
        title: "Value",
        series: ["Metric 1", "Metric 2", "Metric 3", "Metric 4"]
      },
      right: {
        title: "",
        series: []
      }
    }
  }
};

/**
 * Helper function to customize a chart configuration
 * @param {string} configName - Name of the base configuration
 * @param {Object} overrides - Properties to override
 * @returns {Object} Customized configuration
 */
export function customizeChart(configName, overrides = {}) {
  const baseConfig = CHART_CONFIGS[configName];
  if (!baseConfig) {
    throw new Error(`Unknown chart configuration: ${configName}`);
  }

  return {
    ...baseConfig,
    ...overrides,
    series: overrides.series || baseConfig.series,
    yAxis: overrides.yAxis ? { ...baseConfig.yAxis, ...overrides.yAxis } : baseConfig.yAxis
  };
}

/**
 * Quick generator for business funnel with API endpoint
 * @param {string} apiEndpoint - API endpoint for data
 * @param {string} title - Chart title
 * @returns {Object} Ready-to-use configuration
 */
export function createBusinessFunnelConfig(apiEndpoint, title = 'Business Funnel Metrics') {
  return customizeChart('businessFunnel', {
    title,
    apiEndpoint
  });
}

/**
 * Dashboard configurations for modern multi-chart layouts
 */
export const DASHBOARD_CONFIGS = {
  /**
   * Business Analytics Dashboard
   */
  businessAnalytics: {
    title: 'Business Analytics Dashboard',
    theme: 'dark',
    kpis: [
      { label: 'Total Revenue', value: '$125,430', change: '+12.5%', changeType: 'positive' },
      { label: 'Active Customers', value: '2,847', change: '+8.2%', changeType: 'positive' },
      { label: 'Conversion Rate', value: '3.24%', change: '-2.1%', changeType: 'negative' },
      { label: 'Monthly Growth', value: '18.7%', change: '+5.7%', changeType: 'positive' }
    ],
    charts: [
      {
        title: 'Revenue Trend',
        subtitle: 'Monthly revenue over time',
        type: 'line',
        config: { colors: ['#3b82f6', '#10b981'] }
      },
      {
        title: 'Lead Sources',
        subtitle: 'Where leads are coming from',
        type: 'donut',
        config: { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'] }
      },
      {
        title: 'Sales Performance',
        subtitle: 'Team performance comparison',
        type: 'bar',
        config: { colors: ['#8b5cf6'] }
      },
      {
        title: 'User Growth',
        subtitle: 'User acquisition trends',
        type: 'area',
        config: { colors: ['#06b6d4', '#8b5cf6'] }
      }
    ]
  },

  /**
   * Marketing Dashboard
   */
  marketingDashboard: {
    title: 'Marketing Performance',
    theme: 'dark',
    kpis: [
      { label: 'Campaign ROI', value: '284%', change: '+24%', changeType: 'positive' },
      { label: 'Cost per Lead', value: '$23.40', change: '-12%', changeType: 'positive' },
      { label: 'Click Rate', value: '4.8%', change: '+1.2%', changeType: 'positive' },
      { label: 'Impressions', value: '847K', change: '+33%', changeType: 'positive' }
    ],
    charts: [
      {
        title: 'Campaign Performance',
        subtitle: 'ROI by campaign type',
        type: 'bar',
        config: { colors: ['#f59e0b', '#3b82f6'] }
      },
      {
        title: 'Traffic Sources',
        subtitle: 'Website traffic breakdown',
        type: 'donut',
        config: { colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'] }
      },
      {
        title: 'Conversion Funnel',
        subtitle: 'From impression to conversion',
        type: 'line',
        config: { colors: ['#8b5cf6', '#06b6d4'] }
      },
      {
        title: 'Monthly Trends',
        subtitle: 'Growth over time',
        type: 'area',
        config: { colors: ['#10b981', '#3b82f6'] }
      }
    ]
  },

  /**
   * Executive Dashboard
   */
  executiveDashboard: {
    title: 'Executive Overview',
    theme: 'light',
    kpis: [
      { label: 'ARR', value: '$2.4M', change: '+18%', changeType: 'positive' },
      { label: 'Customer LTV', value: '$847', change: '+12%', changeType: 'positive' },
      { label: 'Churn Rate', value: '2.3%', change: '-0.8%', changeType: 'positive' },
      { label: 'Net Profit', value: '$425K', change: '+23%', changeType: 'positive' }
    ],
    charts: [
      {
        title: 'Key Metrics Trend',
        subtitle: 'Revenue, customers, growth',
        type: 'line',
        config: { colors: ['#1f2937', '#374151'] }
      },
      {
        title: 'Revenue Breakdown',
        subtitle: 'By product line',
        type: 'donut',
        config: { colors: ['#1f2937', '#374151', '#6b7280', '#9ca3af'] }
      }
    ]
  }
};

/**
 * Quick generator for business analytics dashboard
 * @param {string} apiEndpoint - API endpoint for data (optional)
 * @param {string} title - Dashboard title
 * @returns {Object} Ready-to-use dashboard configuration
 */
export function createBusinessDashboard(apiEndpoint = null, title = 'Business Analytics Dashboard') {
  return {
    ...DASHBOARD_CONFIGS.businessAnalytics,
    title,
    apiEndpoint
  };
}

/**
 * List all available chart configurations
 * @returns {Array} Array of configuration names
 */
export function listAvailableConfigs() {
  return Object.keys(CHART_CONFIGS);
}

/**
 * List all available dashboard configurations
 * @returns {Array} Array of dashboard configuration names
 */
export function listAvailableDashboards() {
  return Object.keys(DASHBOARD_CONFIGS);
}