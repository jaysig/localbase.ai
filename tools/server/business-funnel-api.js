import Database from 'better-sqlite3';
import { join } from 'path';

export class BusinessFunnelAPI {
    constructor(projectRoot) {
        this.localbaseDbPath = join(projectRoot, 'data/localbase.db');
        this.quickbooksDbPath = join(projectRoot, 'data/quickbooks/quickbooks.db');
        this.googleAdsDbPath = join(projectRoot, 'data/roofmaxx_google_ads/roofmaxx_google_ads.db');
        this.facebookAdsDbPath = join(projectRoot, 'data/roofmaxx_facebook_ads/facebook_daily_ad_spend.db');
        this.invoicesDbPath = join(projectRoot, 'data/roofmaxx_invoices/roofmaxx_lead_invoices.db');
    }

    getBusinessFunnelDataByDates(startDate, endDate) {
        const db = new Database(this.localbaseDbPath);

        try {
            // Attach QuickBooks database
            try {
                db.exec(`ATTACH DATABASE '${this.quickbooksDbPath}' AS quickbooks`);
            } catch (err) {
                console.warn('QuickBooks database not available:', err.message);
            }

            const dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;

            const query = this._buildQuery(dateFilter);
            const rows = db.prepare(query).all();

            // Convert to expected format
            const data = rows.map(row => ({
                date: row.date,
                newLeads: row.newLeads || 0,
                appointments: row.appointments || 0,
                proposalsSent: row.proposalsSent || 0,
                uniqueCustomersPitched: row.uniqueCustomersPitched || 0,
                proposalsSigned: row.proposalsSigned || 0,
                uniqueCustomersSigned: row.uniqueCustomersSigned || 0,
                revenue: row.revenue || 0,
                dispatchAppointments: row.dispatchAppointments || 0,
                dispatchCustomersPitched: row.dispatchCustomersPitched || 0,
                uniqueCustomersWithPayments: row.uniqueCustomersWithPayments || 0
            }));

            // Calculate period-level unique counts (not summed daily counts)
            const summary = this._calculatePeriodSummary(db, startDate, endDate);

            return {
                data,
                summary,
                range: 'custom',
                total: data.length,
                dateRange: {
                    start: data[0]?.date || startDate,
                    end: data[data.length - 1]?.date || endDate
                }
            };

        } finally {
            db.close();
        }
    }

    getBusinessFunnelData(range = 'mtd') {
        const db = new Database(this.localbaseDbPath);

        try {
            // Attach QuickBooks database
            try {
                db.exec(`ATTACH DATABASE '${this.quickbooksDbPath}' AS quickbooks`);
            } catch (err) {
                console.warn('QuickBooks database not available:', err.message);
            }

            // Build date filter based on range
            let dateFilter = '';
            let startDate, endDate;
            const today = new Date().toISOString().split('T')[0];

            switch (range) {
                case 'last7days':
                    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                        .toISOString().split('T')[0];
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
                    break;
                case 'last30days':
                    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        .toISOString().split('T')[0];
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
                    break;
                case 'mtd':
                    startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        .toISOString().split('T')[0];
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
                    break;
                case 'ytd':
                    startDate = `${new Date().getFullYear()}-01-01`;
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
                    break;
                case 'all':
                    startDate = '2020-01-01';
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
                    break;
                default:
                    startDate = '2020-01-01';
                    endDate = today;
                    dateFilter = `AND d.date >= '${startDate}' AND d.date <= '${endDate}'`;
            }

            const query = this._buildQuery(dateFilter);
            const rows = db.prepare(query).all();

            // Convert to expected format
            const data = rows.map(row => ({
                date: row.date,
                newLeads: row.newLeads || 0,
                appointments: row.appointments || 0,
                proposalsSent: row.proposalsSent || 0,
                uniqueCustomersPitched: row.uniqueCustomersPitched || 0,
                proposalsSigned: row.proposalsSigned || 0,
                uniqueCustomersSigned: row.uniqueCustomersSigned || 0,
                revenue: row.revenue || 0,
                dispatchAppointments: row.dispatchAppointments || 0,
                dispatchCustomersPitched: row.dispatchCustomersPitched || 0,
                uniqueCustomersWithPayments: row.uniqueCustomersWithPayments || 0
            }));

            // Calculate period-level unique counts using the requested date range
            const summary = this._calculatePeriodSummary(db, startDate, endDate);

            return {
                data,
                summary,
                range,
                total: data.length,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            };

        } finally {
            db.close();
        }
    }

    _calculatePeriodSummary(db, startDate, endDate) {
        // Calculate actual unique counts across the entire period, not summed daily counts
        const summaryQuery = `
            SELECT
                COUNT(DISTINCT CASE WHEN activity_type = 'proposal_sent' THEN customer_id END) as uniqueCustomersPitched,
                COUNT(DISTINCT CASE WHEN activity_type = 'proposal_signed' THEN customer_id END) as uniqueCustomersSigned,
                COUNT(DISTINCT CASE WHEN activity_type = 'payment_received' THEN customer_id END) as uniqueCustomersWithPayments,
                COUNT(DISTINCT CASE WHEN activity_type = 'proposal_sent' AND source_system = 'dispatch' THEN customer_id END) as dispatchCustomersPitched
            FROM customer_activities
            WHERE DATE(occurred_at) >= ? AND DATE(occurred_at) <= ?
        `;

        const summary = db.prepare(summaryQuery).get(startDate, endDate);

        // Get QuickBooks P&L total income from pl_income_summary
        let totalIncome = 0;
        try {
            // First try to get from P&L summary (most accurate)
            const plQuery = `SELECT SUM(amount) as total FROM quickbooks.pl_income_summary`;
            const plData = db.prepare(plQuery).get();

            if (plData && plData.total) {
                // We have P&L data - prorate it based on the requested date range
                const allTimeStart = '2020-01-01';
                const allTimeEnd = new Date().toISOString().split('T')[0];
                const totalDays = Math.ceil((new Date(allTimeEnd) - new Date(allTimeStart)) / (1000 * 60 * 60 * 24));
                const requestedDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

                // Prorate the P&L total based on days in the requested range
                totalIncome = plData.total * (requestedDays / totalDays);
            } else {
                // Fallback: use monthly proration from daily_income_totals
                const incomeQuery = `
                    WITH monthly_overlaps AS (
                        SELECT
                            period_start,
                            period_end,
                            total_income,
                            MAX(period_start, ?) as overlap_start,
                            MIN(period_end, ?) as overlap_end,
                            (julianday(period_end) - julianday(period_start) + 1) as month_days
                        FROM quickbooks.daily_income_totals
                        WHERE period_start = DATE(period_start, 'start of month')
                          AND period_end = DATE(period_end, 'start of month', '+1 month', '-1 day')
                          AND period_start <= ?
                          AND period_end >= ?
                    )
                    SELECT SUM(
                        total_income *
                        (julianday(overlap_end) - julianday(overlap_start) + 1) /
                        month_days
                    ) as total
                    FROM monthly_overlaps
                    WHERE julianday(overlap_end) >= julianday(overlap_start)
                `;
                const incomeData = db.prepare(incomeQuery).get(startDate, endDate, endDate, startDate);
                totalIncome = incomeData?.total || 0;
            }
        } catch (err) {
            console.warn('Could not fetch P&L income data:', err.message);
        }

        return {
            uniqueCustomersPitched: summary.uniqueCustomersPitched || 0,
            uniqueCustomersSigned: summary.uniqueCustomersSigned || 0,
            uniqueCustomersWithPayments: summary.uniqueCustomersWithPayments || 0,
            dispatchCustomersPitched: summary.dispatchCustomersPitched || 0,
            totalIncome
        };
    }

    _buildQuery(dateFilter) {
        return `
            -- Combined business funnel data query
            WITH all_dates AS (
                SELECT DISTINCT DATE(occurred_at) as date
                FROM customer_activities
                WHERE occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')

                UNION

                SELECT DISTINCT txn_date as date
                FROM quickbooks.daily_transactions
                WHERE is_income = 1
                    AND txn_date >= '2020-01-01'
                    AND txn_date <= DATE('now')
            ),

            -- Get customer activity metrics by date
            activity_metrics AS (
                SELECT
                    DATE(occurred_at) as date,
                    SUM(CASE WHEN activity_type = 'deal_created' THEN 1 ELSE 0 END) as newLeads,
                    SUM(CASE WHEN activity_type = 'appointment_scheduled' THEN 1 ELSE 0 END) as appointments,
                    SUM(CASE WHEN activity_type = 'proposal_sent' THEN 1 ELSE 0 END) as proposalsSent,
                    SUM(CASE WHEN activity_type = 'proposal_signed' THEN 1 ELSE 0 END) as proposalsSigned
                FROM customer_activities
                WHERE occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            -- Get unique customers pitched by date
            unique_customers_pitched AS (
                SELECT
                    DATE(occurred_at) as date,
                    COUNT(DISTINCT customer_id) as uniqueCustomersPitched
                FROM customer_activities
                WHERE activity_type = 'proposal_sent'
                    AND occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            -- Get unique customers signed by date
            unique_customers_signed AS (
                SELECT
                    DATE(occurred_at) as date,
                    COUNT(DISTINCT customer_id) as uniqueCustomersSigned
                FROM customer_activities
                WHERE activity_type = 'proposal_signed'
                    AND occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            -- Get dispatch-only metrics for bid rate calculation
            dispatch_appointments AS (
                SELECT
                    DATE(occurred_at) as date,
                    SUM(CASE WHEN activity_type = 'appointment_scheduled' AND source_system = 'dispatch' THEN 1 ELSE 0 END) as dispatchAppointments
                FROM customer_activities
                WHERE occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            dispatch_customers_pitched AS (
                SELECT
                    DATE(occurred_at) as date,
                    COUNT(DISTINCT customer_id) as dispatchCustomersPitched
                FROM customer_activities
                WHERE activity_type = 'proposal_sent'
                    AND source_system = 'dispatch'
                    AND occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            -- Get unique customers with payments by date
            unique_customers_payments AS (
                SELECT
                    DATE(occurred_at) as date,
                    COUNT(DISTINCT customer_id) as uniqueCustomersWithPayments
                FROM customer_activities
                WHERE activity_type = 'payment_received'
                    AND occurred_at IS NOT NULL
                    AND DATE(occurred_at) >= '2020-01-01'
                    AND DATE(occurred_at) <= DATE('now')
                GROUP BY DATE(occurred_at)
            ),

            -- Get revenue by date from QuickBooks
            revenue_metrics AS (
                SELECT
                    txn_date as date,
                    SUM(amount) as revenue
                FROM quickbooks.daily_transactions
                WHERE is_income = 1
                    AND txn_date >= '2020-01-01'
                    AND txn_date <= DATE('now')
                GROUP BY txn_date
            )

            -- Combine all data with range filter
            SELECT
                d.date,
                COALESCE(a.newLeads, 0) as newLeads,
                COALESCE(a.appointments, 0) as appointments,
                COALESCE(a.proposalsSent, 0) as proposalsSent,
                COALESCE(ucp.uniqueCustomersPitched, 0) as uniqueCustomersPitched,
                COALESCE(a.proposalsSigned, 0) as proposalsSigned,
                COALESCE(ucs.uniqueCustomersSigned, 0) as uniqueCustomersSigned,
                COALESCE(r.revenue, 0) as revenue,
                COALESCE(da.dispatchAppointments, 0) as dispatchAppointments,
                COALESCE(dcp.dispatchCustomersPitched, 0) as dispatchCustomersPitched,
                COALESCE(ucpay.uniqueCustomersWithPayments, 0) as uniqueCustomersWithPayments
            FROM all_dates d
            LEFT JOIN activity_metrics a ON d.date = a.date
            LEFT JOIN unique_customers_pitched ucp ON d.date = ucp.date
            LEFT JOIN unique_customers_signed ucs ON d.date = ucs.date
            LEFT JOIN revenue_metrics r ON d.date = r.date
            LEFT JOIN dispatch_appointments da ON d.date = da.date
            LEFT JOIN dispatch_customers_pitched dcp ON d.date = dcp.date
            LEFT JOIN unique_customers_payments ucpay ON d.date = ucpay.date
            WHERE 1=1 ${dateFilter}
            ORDER BY d.date;
        `;
    }

    getMarketingSpendByDates(startDate, endDate) {
        const results = {};

        // Get Google Ads spend
        try {
            const googleDb = new Database(this.googleAdsDbPath, { readonly: true });
            const googleRows = googleDb.prepare(`
                SELECT date, SUM(cost) as spend
                FROM google_ads_data
                WHERE date >= ? AND date <= ?
                GROUP BY date
            `).all(startDate, endDate);
            googleDb.close();

            googleRows.forEach(row => {
                if (!results[row.date]) results[row.date] = { date: row.date, googleAds: 0, facebookAds: 0, invoices: 0 };
                results[row.date].googleAds = row.spend || 0;
            });
        } catch (err) {
            console.warn('Google Ads database error:', err.message);
        }

        // Get Facebook Ads spend
        try {
            const facebookDb = new Database(this.facebookAdsDbPath, { readonly: true });
            const facebookRows = facebookDb.prepare(`
                SELECT date, SUM(amount_spent_usd) as spend
                FROM facebook_daily_ad_spend
                WHERE date >= ? AND date <= ?
                GROUP BY date
            `).all(startDate, endDate);
            facebookDb.close();

            facebookRows.forEach(row => {
                if (!results[row.date]) results[row.date] = { date: row.date, googleAds: 0, facebookAds: 0, invoices: 0 };
                results[row.date].facebookAds = row.spend || 0;
            });
        } catch (err) {
            console.warn('Facebook Ads database error:', err.message);
        }

        // Get Invoice spend
        try {
            const invoicesDb = new Database(this.invoicesDbPath, { readonly: true });
            const invoiceRows = invoicesDb.prepare(`
                SELECT invoice_date as date, SUM(invoice_total) as spend
                FROM invoices
                WHERE invoice_date >= ? AND invoice_date <= ?
                GROUP BY invoice_date
            `).all(startDate, endDate);
            invoicesDb.close();

            invoiceRows.forEach(row => {
                if (!results[row.date]) results[row.date] = { date: row.date, googleAds: 0, facebookAds: 0, invoices: 0 };
                results[row.date].invoices = row.spend || 0;
            });
        } catch (err) {
            console.warn('Invoices database error:', err.message);
        }

        // Convert to array and add total
        const data = Object.values(results).map(row => ({
            ...row,
            total: row.googleAds + row.facebookAds + row.invoices
        })).sort((a, b) => a.date.localeCompare(b.date));

        return {
            data,
            total: data.length,
            dateRange: {
                start: startDate,
                end: endDate
            }
        };
    }
}