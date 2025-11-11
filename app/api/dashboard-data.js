#!/usr/bin/env node

/**
 * Dashboard Data API
 * Serves real-time metrics data for the business dashboard
 */

import { getDashboardData } from '../../scripts/dashboard-data.js';

// Function to calculate percentage change
function calculateChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

// Function to determine trend direction
function getTrend(change) {
    if (change > 5) return 'positive';
    if (change < -5) return 'negative';
    return 'neutral';
}

async function getDashboardWithTrends(timeRange = '30d') {
    // Get current period data
    const currentData = await getDashboardData(timeRange);

    // Get previous period data for comparison
    let previousTimeRange;
    switch (timeRange) {
        case '7d':
            previousTimeRange = '7d'; // Compare with previous 7 days (will need custom date range)
            break;
        case '30d':
            previousTimeRange = '30d'; // Compare with previous 30 days
            break;
        case '90d':
            previousTimeRange = '90d'; // Compare with previous 90 days
            break;
        default:
            previousTimeRange = '30d';
    }

    // For now, we'll use the 7d data as a baseline for change calculations
    const baselineData = await getDashboardData('7d');

    // Calculate changes (simplified - using 7d as baseline)
    const changes = {
        newLeads: calculateChange(currentData.metrics.newLeads, baselineData.metrics.newLeads || 1),
        appointments: calculateChange(currentData.metrics.appointments, baselineData.metrics.appointments || 1),
        proposalsSent: calculateChange(currentData.metrics.proposalsSent, baselineData.metrics.proposalsSent || 1),
        proposalsSigned: calculateChange(currentData.metrics.proposalsSigned, baselineData.metrics.proposalsSigned || 1),
        revenue: calculateChange(currentData.metrics.revenue, baselineData.metrics.revenue || 1),
        adSpend: 0
    };

    // Build response with trends
    const response = {
        timeRange,
        timestamp: currentData.timestamp,
        data: {
            newLeads: {
                value: currentData.metrics.newLeads,
                change: changes.newLeads,
                trend: getTrend(changes.newLeads)
            },
            appointments: {
                value: currentData.metrics.appointments,
                change: changes.appointments,
                trend: getTrend(changes.appointments)
            },
            proposalsSent: {
                value: currentData.metrics.proposalsSent,
                change: changes.proposalsSent,
                trend: getTrend(changes.proposalsSent)
            },
            proposalsSigned: {
                value: currentData.metrics.proposalsSigned,
                change: changes.proposalsSigned,
                trend: getTrend(changes.proposalsSigned)
            },
            revenue: {
                value: currentData.metrics.revenue,
                change: changes.revenue,
                trend: getTrend(changes.revenue)
            },
            adSpend: {
                value: currentData.metrics.adSpend,
                change: 0,
                trend: 'neutral'
            }
        }
    };

    return response;
}

// Export for use as module
export { getDashboardWithTrends };

// CLI usage for testing
if (import.meta.url === `file://${process.argv[1]}`) {
    const timeRange = process.argv[2] || '30d';

    getDashboardWithTrends(timeRange)
        .then(data => {
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
}