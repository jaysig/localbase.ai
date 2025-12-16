import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { TrendingUp, DollarSign, BarChart3, Database, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RandomForestRegression } from 'ml-random-forest'
import ApexCharts from 'apexcharts'

// Correlation calculation helper with p-value
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return { r: 0, p: 1, significant: false }

  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = (n * sumXY) - (sumX * sumY)
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return { r: 0, p: 1, significant: false }

  const r = numerator / denominator

  // Calculate p-value using t-statistic
  // t = r * sqrt(n - 2) / sqrt(1 - r^2)
  // df = n - 2
  const df = n - 2
  const t = Math.abs(r) * Math.sqrt(df) / Math.sqrt(1 - r * r)

  // Approximate p-value using t-distribution
  // For large df, t-distribution approaches normal distribution
  const pValue = 2 * (1 - tCDF(t, df))

  // Significant if p < 0.05
  const significant = pValue < 0.05

  return { r, p: pValue, significant }
}

// t-distribution CDF approximation (for p-value calculation)
function tCDF(t, df) {
  // For large df (>30), use normal approximation
  if (df > 30) {
    return normalCDF(t)
  }

  // For small df, use approximation
  const x = df / (df + t * t)
  return 1 - 0.5 * betaIncomplete(df / 2, 0.5, x)
}

// Normal CDF approximation
function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - probability : probability
}

// Incomplete beta function approximation (for t-distribution)
function betaIncomplete(a, b, x) {
  if (x === 0) return 0
  if (x === 1) return 1

  // Simple approximation for our use case
  // This is sufficient for significance testing
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  const factor = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta)

  if (x < (a + 1) / (a + b + 2)) {
    return factor * betaContinuedFraction(a, b, x) / a
  } else {
    return 1 - factor * betaContinuedFraction(b, a, 1 - x) / b
  }
}

// Log gamma function (for beta function)
function logGamma(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

// Beta continued fraction
function betaContinuedFraction(a, b, x) {
  const maxIterations = 100
  const epsilon = 3.0e-7

  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap

  if (Math.abs(d) < epsilon) d = epsilon
  d = 1 / d
  let h = d

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < epsilon) d = epsilon
    c = 1 + aa / c
    if (Math.abs(c) < epsilon) c = epsilon
    d = 1 / d
    h *= d * c

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < epsilon) d = epsilon
    c = 1 + aa / c
    if (Math.abs(c) < epsilon) c = epsilon
    d = 1 / d
    const del = d * c
    h *= del

    if (Math.abs(del - 1) < epsilon) break
  }

  return h
}

// Shift array forward by N positions (for lag analysis)
function shiftArray(arr, lag) {
  if (lag === 0) return arr
  const shifted = new Array(lag).fill(0)
  shifted.push(...arr.slice(0, -lag))
  return shifted
}

// Calculate correlation matrix for all outcomes at all lags
function calculateCorrelationMatrix(spendData, outcomes, maxLag = 12) {
  const matrix = []

  for (let lag = 0; lag <= maxLag; lag++) {
    const row = { lag }

    outcomes.forEach(outcome => {
      const shifted = shiftArray(outcome.data, lag)
      const result = calculateCorrelation(spendData, shifted)
      row[outcome.name] = result.r // Store r value
      row[`${outcome.name}_p`] = result.p // Store p-value
      row[`${outcome.name}_sig`] = result.significant // Store significance flag
    })

    matrix.push(row)
  }

  return matrix
}

// Group variables by business category
function groupVariables(variables) {
  const groups = {
    'Ad Spend': [],
    'HubSpot Deals': [],
    'Revenue': [],
    'Conversions': [],
    'Meetings': [],
    'Analytics': [],
    'Organic': [],
    'Other': []
  }

  variables.forEach(variable => {
    const id = variable.id
    const label = variable.label?.toLowerCase() || ''

    // Ad spend channels
    if (id === 'totalSpend' || id === 'google-ads' || id === 'facebook-ads' || id === 'bing-ads') {
      groups['Ad Spend'].push(variable)
    }
    // HubSpot deals (counts)
    else if (id === 'newDeals' || id === 'renewalDeals' || id === 'expansionDeals') {
      groups['HubSpot Deals'].push(variable)
    }
    // Revenue metrics
    else if (id.includes('Revenue') || id === 'totalRevenue') {
      groups['Revenue'].push(variable)
    }
    // Meetings
    else if (id.includes('meetings') || id.includes('Meetings')) {
      groups['Meetings'].push(variable)
    }
    // Conversions / signups
    else if (id === 'businessAccounts' || id === 'userAccounts' || id === 'businessCreated' || id === 'businessSignups') {
      groups['Conversions'].push(variable)
    }
    // Analytics (GA4, GSC)
    else if (id.startsWith('ga4') || id.startsWith('gsc')) {
      groups['Analytics'].push(variable)
    }
    // Organic (YouTube, etc)
    else if (id === 'youtubeViews' || id.includes('organic') || id.includes('Organic')) {
      groups['Organic'].push(variable)
    }
    // Fallback
    else {
      groups['Other'].push(variable)
    }
  })

  return groups
}

// Multiple Linear Regression
function multipleLinearRegression(X, y) {
  // X is a 2D array of inputs (n samples × m features)
  // y is a 1D array of outcomes (n samples)

  const n = X.length
  const m = X[0].length

  // Add intercept column (all 1s) to X
  const X_with_intercept = X.map(row => [1, ...row])

  // Calculate (X^T * X)
  const XtX = []
  for (let i = 0; i < m + 1; i++) {
    XtX[i] = []
    for (let j = 0; j < m + 1; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += X_with_intercept[k][i] * X_with_intercept[k][j]
      }
      XtX[i][j] = sum
    }
  }

  // Calculate (X^T * y)
  const Xty = []
  for (let i = 0; i < m + 1; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) {
      sum += X_with_intercept[k][i] * y[k]
    }
    Xty[i] = sum
  }

  // Solve (X^T * X)^-1 * (X^T * y) using Gaussian elimination
  const coefficients = gaussianElimination(XtX, Xty)

  // Calculate predictions
  const predictions = X_with_intercept.map(row =>
    row.reduce((sum, val, idx) => sum + val * coefficients[idx], 0)
  )

  // Calculate R²
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0)
  const ssResidual = y.reduce((sum, val, idx) => sum + Math.pow(val - predictions[idx], 2), 0)
  const r2 = 1 - (ssResidual / ssTotal)

  // Calculate standard errors and p-values (simplified)
  const residuals = y.map((val, idx) => val - predictions[idx])
  const mse = ssResidual / (n - m - 1)

  return {
    intercept: coefficients[0],
    coefficients: coefficients.slice(1),
    r2: r2,
    predictions: predictions,
    residuals: residuals
  }
}

// Gaussian elimination to solve linear system
function gaussianElimination(A, b) {
  const n = A.length
  const augmented = A.map((row, i) => [...row, b[i]])

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i]
      for (let j = i; j < n + 1; j++) {
        augmented[k][j] -= factor * augmented[i][j]
      }
    }
  }

  // Back substitution
  const x = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j]
    }
    x[i] /= augmented[i][i]
  }

  return x
}

// Multi-Input Regression View
function MultiInputView({ allVariables, lagMonths, getCorrelationColor, viewTab }) {
  // Initialize with first variable as outcome, totalSpend (or first input) selected
  const [selectedOutcome, setSelectedOutcome] = useState(allVariables[0]?.id || '')
  const [selectedInputs, setSelectedInputs] = useState(() => {
    const initial = {}
    allVariables.forEach(v => {
      // Select totalSpend by default, or first variable if totalSpend doesn't exist
      initial[v.id] = v.id === 'totalSpend' || (allVariables.find(x => x.id === 'totalSpend') === undefined && v === allVariables[0])
    })
    return initial
  })

  // All variables can be inputs or outcomes - user decides
  const inputVariables = allVariables
  const outcomeVariables = allVariables

  // Get selected outcome data
  const outcomeVar = allVariables.find(v => v.id === selectedOutcome)
  if (!outcomeVar) return null

  // Prepare regression data
  const selectedInputVars = inputVariables.filter(v => selectedInputs[v.id])

  if (selectedInputVars.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Multi-Input Regression</h3>
        <p className="text-muted-foreground">Please select at least one input variable.</p>
      </div>
    )
  }

  // Build X matrix (inputs) and y vector (outcome)
  const shiftedOutcome = shiftArray(outcomeVar.data, lagMonths)
  const X = []
  const y = []

  for (let i = 0; i < outcomeVar.data.length; i++) {
    const row = selectedInputVars.map(v => v.data[i])
    X.push(row)
    y.push(shiftedOutcome[i])
  }

  // Run regression
  const results = multipleLinearRegression(X, y)

  // Calculate normalized importance (relative contribution)
  const totalAbsCoef = results.coefficients.reduce((sum, c) => sum + Math.abs(c), 0)
  const importance = results.coefficients.map(c => (Math.abs(c) / totalAbsCoef) * 100)

  // Calculate ML-based feature importance using Random Forest
  const calculateMLImportance = () => {
    try {
      // Train Random Forest
      const rf = new RandomForestRegression({
        nEstimators: 100,
        maxFeatures: Math.floor(Math.sqrt(selectedInputVars.length)),
        seed: 42
      })

      rf.train(X, y)

      // Calculate feature importance via permutation
      const baselinePredictions = rf.predict(X)
      const baselineMSE = y.reduce((sum, val, idx) =>
        sum + Math.pow(val - baselinePredictions[idx], 2), 0) / y.length

      const importanceScores = selectedInputVars.map((v, featureIdx) => {
        // Permute this feature
        const permutedX = X.map(row => [...row])
        const featureValues = permutedX.map(row => row[featureIdx])

        // Shuffle the feature values
        for (let i = featureValues.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[featureValues[i], featureValues[j]] = [featureValues[j], featureValues[i]]
        }

        // Replace with shuffled values
        permutedX.forEach((row, idx) => {
          row[featureIdx] = featureValues[idx]
        })

        // Calculate MSE with permuted feature
        const permutedPredictions = rf.predict(permutedX)
        const permutedMSE = y.reduce((sum, val, idx) =>
          sum + Math.pow(val - permutedPredictions[idx], 2), 0) / y.length

        // Importance = increase in error when feature is permuted
        return Math.max(0, permutedMSE - baselineMSE)
      })

      // Calculate R² for the RF model
      const yMean = y.reduce((a, b) => a + b, 0) / y.length
      const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0)
      const ssResidual = y.reduce((sum, val, idx) =>
        sum + Math.pow(val - baselinePredictions[idx], 2), 0)
      const r2 = 1 - (ssResidual / ssTotal)

      // Normalize to percentages
      const totalImportance = importanceScores.reduce((sum, score) => sum + score, 0)
      const normalizedImportance = importanceScores.map(score =>
        (score / totalImportance) * 100)

      return { importanceScores: normalizedImportance, r2 }
    } catch (error) {
      console.error('Error calculating ML importance:', error)
      return null
    }
  }

  const mlResults = viewTab === 'mlImportance' ? calculateMLImportance() : null

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          {viewTab === 'regression' ? 'Multiple Linear Regression' : 'Random Forest Feature Importance'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {viewTab === 'regression'
            ? 'Analyze how multiple inputs combine to predict an outcome. Coefficients show the impact of each input.'
            : 'Machine learning-based importance using Random Forest regression. Shows which features are most predictive, accounting for non-linear relationships.'}
        </p>

        <div className="grid grid-cols-2 gap-6">
          {/* Outcome Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Outcome</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {outcomeVariables.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Input Selection - Grouped */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Inputs</label>
            <div className="grid grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
              {(() => {
                const groups = groupVariables(inputVariables)
                return Object.entries(groups)
                  .filter(([_, vars]) => vars.length > 0)
                  .map(([groupName, variables]) => (
                    <div key={groupName} className="space-y-1.5">
                      <div className="text-xs font-bold text-muted-foreground pb-1 border-b border-border">
                        {groupName}
                      </div>
                      {variables.map(v => (
                        <label key={v.id} className="flex items-start gap-1.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedInputs[v.id] || false}
                            onChange={(e) => setSelectedInputs(prev => ({
                              ...prev,
                              [v.id]: e.target.checked
                            }))}
                            className="w-3.5 h-3.5 mt-0.5 rounded border-border bg-secondary flex-shrink-0"
                          />
                          <span className="text-xs leading-tight group-hover:text-foreground text-muted-foreground">
                            {v.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-card border border-border rounded-lg p-6">
        {viewTab === 'regression' ? (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Linear Regression Results</h3>
                <div className="text-sm">
                  <span className="text-muted-foreground">R² = </span>
                  <span className={`font-bold ${results.r2 > 0.7 ? 'text-green-400' : results.r2 > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(results.r2 * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({results.r2 > 0.7 ? 'Strong' : results.r2 > 0.4 ? 'Moderate' : 'Weak'} fit)
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Method: Multiple Linear Regression | Lag: {lagMonths} {lagMonths === 1 ? 'month' : 'months'}
              </p>
            </div>

            <table className="w-full border-collapse">
              <thead className="border-b border-border">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">Input Variable</th>
                  <th className="p-3 font-medium text-right">Coefficient</th>
                  <th className="p-3 font-medium text-right">Importance</th>
                  <th className="p-3 font-medium">Impact</th>
                </tr>
              </thead>
              <tbody>
                {selectedInputVars.map((v, idx) => {
                  const coef = results.coefficients[idx]
                  const imp = importance[idx]
                  return (
                    <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3 font-medium">{v.label}</td>
                      <td className="p-3 text-right font-mono">
                        <span className={coef > 0 ? 'text-green-400' : 'text-red-400'}>
                          {coef > 0 ? '+' : ''}{coef.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {imp.toFixed(1)}%
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${coef > 0 ? 'bg-green-400' : 'bg-red-400'}`}
                              style={{ width: `${imp}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="mt-6 p-4 bg-secondary/30 rounded border border-border">
              <div className="text-sm font-medium mb-2">Interpretation:</div>
              <div className="text-sm text-muted-foreground">
                <strong>Intercept:</strong> {results.intercept.toFixed(2)} (baseline {outcomeVar.label} when all inputs are zero)
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Each coefficient shows the change in {outcomeVar.label} for a 1-unit increase in that input variable, holding other inputs constant.
              </div>
            </div>
          </>
        ) : mlResults ? (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">ML Feature Importance Results</h3>
                <div className="text-sm">
                  <span className="text-muted-foreground">R² = </span>
                  <span className={`font-bold ${mlResults.r2 > 0.7 ? 'text-green-400' : mlResults.r2 > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(mlResults.r2 * 100).toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({mlResults.r2 > 0.7 ? 'Strong' : mlResults.r2 > 0.4 ? 'Moderate' : 'Weak'} fit)
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Method: Random Forest (100 trees) + Permutation Importance | Lag: {lagMonths} {lagMonths === 1 ? 'month' : 'months'}
              </p>
            </div>

            <table className="w-full border-collapse">
              <thead className="border-b border-border">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">Feature</th>
                  <th className="p-3 font-medium text-right">Importance</th>
                  <th className="p-3 font-medium">Predictive Power</th>
                </tr>
              </thead>
              <tbody>
                {selectedInputVars
                  .map((v, idx) => ({ variable: v, importance: mlResults.importanceScores[idx] }))
                  .sort((a, b) => b.importance - a.importance)
                  .map(({ variable, importance }) => (
                    <tr key={variable.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3 font-medium">{variable.label}</td>
                      <td className="p-3 text-right font-mono text-sm">
                        <span className="text-green-400">{importance.toFixed(1)}%</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-green-400"
                              style={{ width: `${importance}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div className="mt-6 p-4 bg-secondary/30 rounded border border-border">
              <div className="text-sm font-medium mb-2">Interpretation:</div>
              <div className="text-sm text-muted-foreground">
                Feature importance is calculated using <strong>permutation importance</strong> on a Random Forest model.
                Each score represents how much the model's prediction error increases when that feature's values are randomly shuffled.
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Higher importance = more predictive power. This method captures non-linear relationships and feature interactions that linear regression may miss.
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Calculating ML feature importance...
          </div>
        )}
      </div>
    </div>
  )
}

// Full Correlation Matrix View - ALL variables against ALL variables
function MatrixView({ allVariables, lagMonths, getCorrelationColor }) {
  const groupedVars = groupVariables(allVariables)

  // Flatten groups back into ordered array for matrix calculation
  const orderedVariables = []
  Object.values(groupedVars).forEach(group => {
    orderedVariables.push(...group)
  })

  // Calculate correlation matrix for all variables against all variables
  const calculateFullMatrix = () => {
    const matrix = []

    orderedVariables.forEach(inputVar => {
      const row = { input: inputVar.label, id: inputVar.id, variable: inputVar }

      orderedVariables.forEach(outputVar => {
        if (inputVar.id === outputVar.id) {
          // Self-correlation is always 1
          row[outputVar.id] = 1.0
          row[`${outputVar.id}_sig`] = true
          row[`${outputVar.id}_p`] = 0
        } else {
          // Shift output by lag and calculate correlation
          const shiftedOutput = shiftArray(outputVar.data, lagMonths)
          const result = calculateCorrelation(inputVar.data, shiftedOutput)
          row[outputVar.id] = result.r
          row[`${outputVar.id}_sig`] = result.significant
          row[`${outputVar.id}_p`] = result.p
        }
      })

      matrix.push(row)
    })

    return matrix
  }

  const matrix = calculateFullMatrix()

  // Helper to get background color based on correlation
  const getCellBgColor = (corr) => {
    const absCorr = Math.abs(corr)
    if (absCorr < 0.3) return 'bg-red-900/30'
    if (absCorr < 0.6) return 'bg-yellow-900/30'
    return 'bg-green-900/30'
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Full Correlation Matrix</h3>
        <p className="text-sm text-muted-foreground">
          All variables (rows) correlated against all variables (columns) at {lagMonths} {lagMonths === 1 ? 'month' : 'months'} lag.
          Discover hidden relationships like "YouTube Views → Deals" or "Direct Traffic → Businesses".
        </p>
      </div>

      <div className="overflow-x-auto relative">
        <table className="w-full border-collapse text-sm relative">
          <thead>
            {/* Group header row for columns */}
            <tr className="border-b-2 border-border">
              <th className="sticky left-0 bg-card z-20 min-w-[200px] max-w-[200px] w-[200px]"></th>
              {Object.entries(groupedVars).map(([groupName, variables]) =>
                variables.length > 0 && (
                  <th key={groupName} colSpan={variables.length} className="p-2 text-center text-xs font-bold text-foreground bg-secondary">
                    {groupName}
                  </th>
                )
              )}
            </tr>
            {/* Variable labels row */}
            <tr className="border-b border-border">
              <th className="p-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-card z-20 border-r border-border min-w-[200px] max-w-[200px] w-[200px]">
                Input →<br/>Outcome ↓
              </th>
              {orderedVariables.map(v => (
                <th key={v.id} className="p-1 text-center text-xs font-medium text-muted-foreground min-w-[60px] max-w-[60px] w-[60px] h-[260px] relative align-bottom">
                  <div className="absolute bottom-28 left-1/2 -translate-x-1/2 origin-center rotate-[-90deg] whitespace-nowrap">
                    {v.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedVars).map(([groupName, groupVars]) =>
              groupVars.length > 0 && (
                <Fragment key={groupName}>
                  {/* Group header row for rows */}
                  <tr className="bg-secondary">
                    <td className="p-1.5 text-xs font-bold text-foreground sticky left-0 z-20 bg-secondary border-r border-border min-w-[200px] max-w-[200px] w-[200px]">
                      {groupName}
                    </td>
                    <td colSpan={orderedVariables.length} className="p-1.5 bg-secondary"></td>
                  </tr>
                  {/* Data rows for this group */}
                  {matrix.filter(row => groupVars.some(v => v.id === row.id)).map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-2 text-xs font-medium sticky left-0 bg-card z-20 whitespace-nowrap border-r border-border min-w-[200px] max-w-[200px] w-[200px]">
                        {row.input}
                      </td>
                      {orderedVariables.map(v => {
                        const corr = row[v.id]
                        const isSignificant = row[`${v.id}_sig`]
                        const pValue = row[`${v.id}_p`]
                        const isSelf = row.id === v.id

                        return (
                          <td
                            key={v.id}
                            className={`p-1 text-center ${!isSelf && getCellBgColor(corr)} group relative min-w-[60px] max-w-[60px] w-[60px]`}
                          >
                            <div className={`text-xs font-mono font-bold ${isSelf ? 'text-gray-600' : getCorrelationColor(corr)}`}>
                              {corr.toFixed(2)}
                              {!isSelf && isSignificant && <span className="ml-0.5 text-green-400">*</span>}
                            </div>
                            {!isSelf && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                                <div className="bg-gray-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap shadow-lg border border-gray-700">
                                  <div className="font-semibold mb-1">r = {corr.toFixed(3)}</div>
                                  <div className="text-gray-300">p-value = {pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}</div>
                                  <div className={`mt-1 ${isSignificant ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {isSignificant ? '✓ Significant' : '✗ Not significant'}
                                  </div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-900/30 border border-border rounded"></div>
            <span className="text-muted-foreground">Weak (&lt;0.3)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-900/30 border border-border rounded"></div>
            <span className="text-muted-foreground">Moderate (0.3-0.6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-900/30 border border-border rounded"></div>
            <span className="text-muted-foreground">Strong (&gt;0.6)</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-green-400 font-bold">*</span>
            <span className="text-muted-foreground">Statistically significant (p &lt; 0.05)</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          💡 Tip: Hover over any cell to see the exact p-value. Look for correlations that are both <strong>strong</strong> and <strong>significant (*)</strong> - they're most likely to represent real relationships!
        </div>
      </div>
    </div>
  )
}

// Signals View Component
// Helper to get date string for N days ago
function getDateNDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function SignalsView({ onBack, config, toolName }) {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('all') // all, high, medium, low
  const [directionFilter, setDirectionFilter] = useState(null) // null, 'up', 'down'
  const [lastUpdated, setLastUpdated] = useState(null)
  const [date1, setDate1] = useState('') // Current period date
  const [date2, setDate2] = useState('') // Comparison period date
  const [comparisonInfo, setComparisonInfo] = useState(null)

  // Check if we're in browser mode
  const isBrowserMode = !window.electronAPI?.terminal

  // Load signals data from file
  async function loadSignals() {
    try {
      const result = await window.electronAPI.api.readWorkspaceFile('projects/mediatrader-signals/signals-data.json')

      if (result.success) {
        const data = JSON.parse(result.content)
        setSignals(data.signals)
        setLastUpdated(new Date(data.generated))
        setComparisonInfo({
          mode: data.comparisonMode || 'latest',
          weeksAgo: data.weeksAgo || 0,
          date1: data.date1 || null,
          date2: data.date2 || null
        })
        // Update date inputs if we have stored dates
        if (data.date1) setDate1(data.date1)
        if (data.date2) setDate2(data.date2)
      } else {
        console.error('Error loading signals:', result.error)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading signals:', error)
      setLoading(false)
    }
  }

  // Refresh signals data (browser mode only - auto-runs query script)
  async function refreshSignals(d1 = date1, d2 = date2) {
    if (!isBrowserMode) return

    setRefreshing(true)
    try {
      let url = 'http://localhost:3000/api/signals/refresh'
      if (d1 && d2) {
        url += `?date1=${d1}&date2=${d2}`
      }
      const res = await fetch(url, { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        // Reload the updated data
        await loadSignals()
      } else {
        console.error('Error refreshing signals:', result.error)
        // Fall back to loading existing data even if refresh fails
        await loadSignals()
      }
    } catch (error) {
      console.error('Error refreshing signals:', error)
      // Fall back to loading existing data on network error
      await loadSignals()
    }
    setRefreshing(false)
  }

  // Handle date range change
  function handleCompare() {
    if (date1 && date2) {
      refreshSignals(date1, date2)
    }
  }

  // Quick presets
  function applyPreset(preset) {
    let d1, d2
    const today = new Date()
    const dayOfWeek = today.getDay()

    switch (preset) {
      case 'last-week':
        // Last complete week vs week before
        d1 = getDateNDaysAgo(dayOfWeek + 7) // Last week
        d2 = getDateNDaysAgo(dayOfWeek + 14) // Week before last
        break
      case 'this-week':
        // This week vs last week
        d1 = getDateNDaysAgo(dayOfWeek) // This week (Sunday)
        d2 = getDateNDaysAgo(dayOfWeek + 7) // Last week
        break
      case 'last-month':
        // Last month vs month before
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15)
        const monthBefore = new Date(today.getFullYear(), today.getMonth() - 2, 15)
        d1 = lastMonth.toISOString().split('T')[0]
        d2 = monthBefore.toISOString().split('T')[0]
        break
      default:
        return
    }
    setDate1(d1)
    setDate2(d2)
    refreshSignals(d1, d2)
  }

  // Load signals on mount, auto-refresh in browser mode
  useEffect(() => {
    if (isBrowserMode) {
      // Browser mode: try to refresh, then load (with fallback to existing data)
      refreshSignals()
    } else {
      // Electron mode: just load existing data
      loadSignals()
    }
  }, [])

  // Filter signals
  const filteredSignals = useMemo(() => {
    let filtered = signals

    // Apply significance filter
    if (filter !== 'all') {
      filtered = filtered.filter(s => s.significance === filter)
    }

    // Apply direction filter
    if (directionFilter) {
      filtered = filtered.filter(s => s.direction === directionFilter)
    }

    return filtered
  }, [signals, filter, directionFilter])

  // Stats
  const stats = useMemo(() => {
    const highPriority = signals.filter(s => s.significance === 'high').length
    return {
      total: signals.length,
      highPriority
    }
  }, [signals])

  // Format number helper
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return Math.round(num).toLocaleString()
  }

  if (loading || refreshing) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">
          {refreshing ? 'Refreshing signals data...' : 'Loading signals...'}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {toolName || 'MediaTrader'}
            </button>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">Signals</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Date Range Selector + Stats Bar */}
        <div className="flex items-start gap-4 mb-6">
          {/* Date Range Selector */}
          {isBrowserMode && (
            <div className="bg-card border border-border rounded-lg p-4 min-w-[320px]">
              <div className="text-sm text-muted-foreground mb-3">Compare Periods</div>

              {/* Quick Presets */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => applyPreset('last-week')}
                  disabled={refreshing}
                  className="px-2 py-1 text-xs bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                >
                  Last Week
                </button>
                <button
                  onClick={() => applyPreset('this-week')}
                  disabled={refreshing}
                  className="px-2 py-1 text-xs bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                >
                  This Week
                </button>
                <button
                  onClick={() => applyPreset('last-month')}
                  disabled={refreshing}
                  className="px-2 py-1 text-xs bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                >
                  Last Month
                </button>
              </div>

              {/* Date Inputs */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Current</label>
                  <input
                    type="date"
                    value={date1}
                    onChange={(e) => setDate1(e.target.value)}
                    disabled={refreshing}
                    className="w-full px-2 py-1.5 bg-secondary text-foreground border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50"
                  />
                </div>
                <span className="text-muted-foreground mt-5">vs</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Compare To</label>
                  <input
                    type="date"
                    value={date2}
                    onChange={(e) => setDate2(e.target.value)}
                    disabled={refreshing}
                    className="w-full px-2 py-1.5 bg-secondary text-foreground border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50"
                  />
                </div>
                <button
                  onClick={handleCompare}
                  disabled={refreshing || !date1 || !date2}
                  className="mt-5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Go
                </button>
              </div>

              {comparisonInfo?.date1 && comparisonInfo?.date2 && (
                <div className="text-xs text-muted-foreground mt-2">
                  Comparing week of {comparisonInfo.date1} vs {comparisonInfo.date2}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Signals</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">High Priority</div>
              <div className="text-2xl font-bold text-red-400">{stats.highPriority}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Last Updated</div>
              <div className="text-lg font-semibold">
                {lastUpdated ? lastUpdated.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                }) : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === 'all'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('high')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === 'high'
                  ? 'bg-red-400/20 text-red-400 border border-red-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              High Priority
            </button>
            <button
              onClick={() => setFilter('medium')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === 'medium'
                  ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === 'low'
                  ? 'bg-gray-400/20 text-gray-400 border border-gray-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Low
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDirectionFilter(directionFilter === 'up' ? null : 'up')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                directionFilter === 'up'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              📈 Increases
            </button>
            <button
              onClick={() => setDirectionFilter(directionFilter === 'down' ? null : 'down')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                directionFilter === 'down'
                  ? 'bg-red-400/20 text-red-400 border border-red-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              📉 Decreases
            </button>
          </div>
        </div>

        {/* Signals Grid */}
        {filteredSignals.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <div className="text-4xl mb-4 opacity-50">🔍</div>
            <p className="text-muted-foreground">No signals match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSignals.map((signal) => (
              <div
                key={signal.id}
                className={`bg-card border rounded-lg p-4 hover:border-border/60 transition-colors ${
                  signal.significance === 'high' ? 'border-l-4 border-l-red-400' :
                  signal.significance === 'medium' ? 'border-l-4 border-l-yellow-400' :
                  'border-l-4 border-l-gray-600'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-sm">{signal.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded uppercase font-semibold ${
                    signal.significance === 'high' ? 'bg-red-400/20 text-red-400' :
                    signal.significance === 'medium' ? 'bg-yellow-400/20 text-yellow-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>
                    {signal.significance}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Current Week</div>
                    <div className="font-semibold">{formatNumber(signal.currentValue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Previous Week</div>
                    <div className="font-semibold">{formatNumber(signal.previousValue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Change</div>
                    <div className={`font-bold text-lg ${signal.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                      {signal.direction === 'up' ? '↗' : '↘'} {signal.percentChange > 0 ? '+' : ''}{signal.percentChange}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Signal Strength</div>
                    <div className="font-semibold">{signal.signalStrength.toFixed(1)}</div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <div>Z-Score: <span className="text-foreground font-semibold">{signal.zScore}</span></div>
                  <div>Week: <span className="text-foreground font-semibold">{signal.currentWeek}</span></div>
                  <div className="px-2 py-0.5 bg-secondary rounded text-xs">{signal.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Spend Analysis Component
function SpendAnalysis({ onBack, config, toolName }) {
  const [lagMonths, setLagMonths] = useState(0)
  const [dataBySource, setDataBySource] = useState({}) // { sourceId: { name, data: [...] } }
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('matrix') // matrix, regression, mlImportance

  // Keyboard navigation support (Vim keybindings)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if not in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'h' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setLagMonths(prev => Math.max(0, prev - 1))
      } else if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault()
        setLagMonths(prev => Math.min(12, prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Build unified month list from all loaded data sources
  const allMonths = useMemo(() => {
    const monthsSet = new Set()
    Object.values(dataBySource).forEach(source => {
      source.data.forEach(d => monthsSet.add(d.month))
    })
    return Array.from(monthsSet).sort()
  }, [dataBySource])

  // Helper function to extract value from a data row based on available fields
  const extractValue = (row) => {
    return row.spend || row.count || row.value || row.clicks || row.impressions || row.views || row.direct_traffic || 0
  }

  // Build variables array dynamically from loaded data
  const inputOptions = useMemo(() => {
    if (Object.keys(dataBySource).length === 0 || allMonths.length === 0) {
      return []
    }

    const variables = []

    // Add individual data sources as variables
    Object.entries(dataBySource).forEach(([sourceId, sourceInfo]) => {
      const dataArray = allMonths.map(month => {
        const found = sourceInfo.data.find(d => d.month === month)
        return found ? extractValue(found) : 0
      })
      variables.push({
        id: sourceId,
        label: sourceInfo.name,
        data: dataArray
      })
    })

    // Calculate total spend from all channel sources (those with costField)
    const spendSources = Object.entries(dataBySource).filter(([_, info]) => info.isSpend)
    if (spendSources.length > 0) {
      const totalSpendArray = allMonths.map(month => {
        return spendSources.reduce((sum, [sourceId, sourceInfo]) => {
          const found = sourceInfo.data.find(d => d.month === month)
          return sum + (found ? extractValue(found) : 0)
        }, 0)
      })
      // Add total spend as first variable
      variables.unshift({
        id: 'totalSpend',
        label: 'Total Ad Spend',
        data: totalSpendArray
      })
    }

    console.log(`📊 Built ${variables.length} variables from ${Object.keys(dataBySource).length} data sources`)
    return variables
  }, [dataBySource, allMonths])

  // Check if we're in browser mode
  const isBrowserMode = !window.electronAPI?.terminal

  // Load all data sources dynamically from config
  useEffect(() => {
    async function loadData() {
      if (!config) return

      try {
        const allSources = [...config.channels, ...config.conversionSources].filter(s => s.enabled)
        console.log(`📊 MediaTrader: Loading ${allSources.length} data sources from config`)

        let results

        if (isBrowserMode) {
          // Browser mode: use server API
          results = await Promise.all(
            allSources.map(async (source) => {
              try {
                const res = await fetch('http://localhost:3000/api/mediatrader/query', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sourceId: source.id,
                    options: { aggregation: source.costField ? 'sum' : (source.valueField ? 'sum' : 'count') }
                  })
                })
                const data = await res.json()
                return { id: source.id, name: source.name, data, source }
              } catch (err) {
                console.error(`Error loading ${source.id}:`, err)
                return { id: source.id, name: source.name, data: [], source }
              }
            })
          )
        } else if (window.electronAPI?.mediatrader) {
          // Electron mode: use IPC
          results = await Promise.all(
            allSources.map(async (source) => {
              const data = await window.electronAPI.mediatrader.queryDataSource({
                sourceId: source.id,
                options: { aggregation: source.costField ? 'sum' : (source.valueField ? 'sum' : 'count') }
              })
              return { id: source.id, name: source.name, data, source }
            })
          )
        } else {
          console.warn('No data loading method available')
          setLoading(false)
          return
        }

        // Build dataBySource object
        const dataMap = {}
        results.forEach(({ id, name, data, source }) => {
          dataMap[id] = {
            name,
            data,
            isSpend: !!source.costField,
            metadata: source
          }
        })

        console.log(`✅ MediaTrader: Loaded data for ${Object.keys(dataMap).length} sources`)
        setDataBySource(dataMap)
        setLoading(false)
      } catch (error) {
        console.error('❌ Error loading MediaTrader data:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [config, isBrowserMode])

  // Get correlation color
  const getCorrelationColor = (corr) => {
    const absCorr = Math.abs(corr)
    if (absCorr < 0.3) return 'text-red-400'
    if (absCorr < 0.6) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getCorrelationLabel = (corr) => {
    const absCorr = Math.abs(corr)
    if (absCorr < 0.3) return 'Weak'
    if (absCorr < 0.6) return 'Moderate'
    return 'Strong'
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading outcome data...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {toolName || 'MediaTrader'}
            </button>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">Correlations</span>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Matrix
            </button>
            <button
              onClick={() => setViewMode('regression')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'regression'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Regression
            </button>
            <button
              onClick={() => setViewMode('mlImportance')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'mlImportance'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              ML Importance
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Lag Control - Shared across all views */}
        {viewMode !== 'chart' && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">Lag Period</h3>
                <p className="text-sm text-muted-foreground">
                  Adjust to see how variables correlate at different time lags
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={lagMonths}
                  onChange={(e) => setLagMonths(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="text-lg font-semibold text-green-400 min-w-[100px] text-right">
                  {lagMonths} {lagMonths === 1 ? 'month' : 'months'}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {lagMonths === 0
                  ? 'No lag - comparing variables in the same month'
                  : `Outcomes lag ${lagMonths} ${lagMonths === 1 ? 'month' : 'months'} behind inputs`
                }
              </div>
            </div>
          </div>
        )}

        {viewMode === 'matrix' ? (
          <MatrixView
            allVariables={inputOptions}
            lagMonths={lagMonths}
            getCorrelationColor={getCorrelationColor}
          />
        ) : viewMode === 'regression' ? (
          <MultiInputView
            allVariables={inputOptions}
            lagMonths={lagMonths}
            getCorrelationColor={getCorrelationColor}
            viewTab="regression"
          />
        ) : viewMode === 'mlImportance' ? (
          <MultiInputView
            allVariables={inputOptions}
            lagMonths={lagMonths}
            getCorrelationColor={getCorrelationColor}
            viewTab="mlImportance"
          />
        ) : null}
      </div>
    </div>
  )
}

// Apply date range filter to ROAS data
function applyDateRangeFilter(data, dateRange) {
  if (dateRange === 'all') {
    return data // Return full dataset
  }

  // Calculate proportional adjustments based on date range
  const monthsMap = {
    '12m': 12,
    '24m': 24,
    '36m': 36
  }

  const targetMonths = monthsMap[dateRange]
  if (!targetMonths) return data

  // Create filtered data with adjusted metrics
  const filtered = {}

  Object.entries(data).forEach(([channel, pipelines]) => {
    filtered[channel] = {}

    Object.entries(pipelines).forEach(([pipeline, metrics]) => {
      const originalMonths = metrics.months
      const ratio = Math.min(targetMonths / originalMonths, 1)

      // Proportionally adjust spend, revenue, and deals
      const adjustedSpend = metrics.spend * ratio
      const adjustedRevenue = metrics.revenue * ratio
      const adjustedDeals = Math.round(metrics.deals * ratio)

      // Recalculate ROAS with adjusted values
      const adjustedRoas = adjustedSpend > 0 ? adjustedRevenue / adjustedSpend : 0

      // Adjust confidence score based on smaller sample size
      let adjustedConfScore = metrics.confScore
      if (ratio < 0.5) {
        adjustedConfScore = Math.max(metrics.confScore - 20, 30) // Lower confidence for smaller samples
      } else if (ratio < 0.75) {
        adjustedConfScore = Math.max(metrics.confScore - 10, 40)
      }

      // Determine confidence level
      let adjustedConfidence = 'high'
      if (adjustedConfScore < 50) {
        adjustedConfidence = 'low'
      } else if (adjustedConfScore < 70) {
        adjustedConfidence = 'medium'
      }

      filtered[channel][pipeline] = {
        roas: adjustedRoas,
        lag: metrics.lag, // Lag period stays the same
        confidence: adjustedConfidence,
        confScore: adjustedConfScore,
        deals: adjustedDeals,
        revenue: adjustedRevenue,
        spend: adjustedSpend,
        months: Math.min(targetMonths, originalMonths)
      }
    })
  })

  return filtered
}

// Media Mix Modeling - Predictive Optimization
function MediaMixModeling({ onBack, roasData, summary }) {
  const [query, setQuery] = useState('')
  const [scenarios, setScenarios] = useState([])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Calculate optimal allocation based on COAS
  const calculateOptimalAllocation = () => {
    if (!roasData) return null

    const channels = Object.keys(roasData)
    const channelCOAS = channels.map(channel => {
      // Average COAS across all pipelines for this channel
      const pipelines = Object.values(roasData[channel])
      const avgCOAS = pipelines.reduce((sum, p) => sum + p.roas, 0) / pipelines.length
      const currentSpend = pipelines[0].spend
      return { channel, coas: avgCOAS, currentSpend }
    })

    // Sort by COAS (highest first)
    channelCOAS.sort((a, b) => b.coas - a.coas)

    return channelCOAS
  }

  const optimalAllocation = calculateOptimalAllocation()
  const channelNames = {
    'google-ads': 'Google Ads',
    'bing-ads': 'Bing Ads',
    'facebook-ads': 'Facebook Ads'
  }

  const exampleQueries = [
    "What happens if I increase Google Ads spend by 20%?",
    "What's the best way to allocate $50,000 next month?",
    "Which channel should I cut to save $10,000?",
    "What if I double my Bing Ads budget?"
  ]

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-3xl font-bold">Media Mix Modeling</h1>
              <div className="px-2 py-1 rounded text-xs border bg-blue-400/10 border-blue-400 text-blue-400">
                BETA
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              AI-powered spend optimization and outcome prediction
            </p>
          </div>
        </div>

        {/* "What happens if?" Search Input */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What happens if...?"
              className="w-full px-6 py-4 bg-card border-2 border-border rounded-lg text-lg text-foreground placeholder:text-muted-foreground focus:border-green-400 focus:outline-none transition-colors"
            />
            <Button
              className="absolute right-2 top-2 bg-green-400 hover:bg-green-500 text-black"
              disabled={!query.trim()}
            >
              Analyze
            </Button>
          </div>

          {/* Example Queries */}
          <div className="mt-4 flex flex-wrap gap-2">
            {exampleQueries.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setQuery(example)}
                className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:border-green-400/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Current State vs Optimal */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Current Allocation */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Current Allocation</h3>
            <div className="space-y-4">
              {optimalAllocation && optimalAllocation.map(({ channel, currentSpend, coas }) => {
                const totalSpend = optimalAllocation.reduce((sum, c) => sum + c.currentSpend, 0)
                const percentage = (currentSpend / totalSpend * 100).toFixed(1)

                return (
                  <div key={channel}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">{channelNames[channel]}</span>
                      <span className="text-sm text-muted-foreground">{percentage}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 mb-1">
                      <div
                        className="bg-green-400 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(currentSpend)}</span>
                      <span>${coas.toFixed(2)} COAS</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Optimal Allocation */}
          <div className="bg-gradient-to-br from-green-400/5 to-blue-400/5 border border-green-400/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>Recommended Allocation</span>
              <span className="text-xs text-green-400">↑ Based on COAS</span>
            </h3>
            <div className="space-y-4">
              {optimalAllocation && optimalAllocation.map(({ channel, currentSpend, coas }, idx) => {
                // Weight allocation by COAS (highest COAS gets more budget)
                const totalCOAS = optimalAllocation.reduce((sum, c) => sum + c.coas, 0)
                const totalSpend = optimalAllocation.reduce((sum, c) => sum + c.currentSpend, 0)
                const optimalPercentage = (coas / totalCOAS * 100).toFixed(1)
                const optimalSpend = totalSpend * (coas / totalCOAS)

                return (
                  <div key={channel}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">{channelNames[channel]}</span>
                      <span className="text-sm text-green-400">{optimalPercentage}%</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 mb-1">
                      <div
                        className="bg-green-400 h-2 rounded-full transition-all"
                        style={{ width: `${optimalPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(optimalSpend)}</span>
                      <span className="text-green-400">+{((optimalSpend - currentSpend) / currentSpend * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coming Soon Placeholder */}
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Interactive Modeling Coming Soon</h3>
          <p className="text-muted-foreground mb-4">
            Natural language queries and scenario simulation are in development
          </p>
          <div className="flex gap-4 justify-center text-sm text-muted-foreground">
            <div>📊 Budget scenarios</div>
            <div>🎯 ROI predictions</div>
            <div>💡 Smart recommendations</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Media Correlation - Cost Per Outcome Analysis
function MediaCorrelation({ onBack, config, toolName }) {
  const [coasData, setCoasData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState('totalSpend')
  const [dateRange, setDateRange] = useState('24m')
  const [customStartDate, setCustomStartDate] = useState('2023-01-01')
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0])
  const [campaignCategory, setCampaignCategory] = useState('b2b') // 'all' or 'b2b'
  const [campaignType, setCampaignType] = useState('all') // 'all', 'video', 'search'
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Calculate date range for API call
  const getDateRange = () => {
    const today = new Date()
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    if (dateRange === 'custom') {
      return [new Date(customStartDate), new Date(customEndDate)]
    }

    const ranges = {
      '12m': [new Date(today.getFullYear() - 1, today.getMonth(), 1), endDate],
      '24m': [new Date(today.getFullYear() - 2, today.getMonth(), 1), endDate]
    }

    return ranges[dateRange]
  }

  // Load COAS data from API
  useEffect(() => {
    async function loadCOASData() {
      setIsLoadingData(true)
      try {
        const [start, end] = getDateRange()
        const startDateStr = start.toISOString().split('T')[0]
        const endDateStr = end.toISOString().split('T')[0]

        // Build URL with optional campaign filters
        let url = `http://localhost:3000/api/media-correlation/coas?startDate=${startDateStr}&endDate=${endDateStr}`
        if (campaignCategory === 'b2b') {
          url += '&campaignFilter=%25B2B%25,%25SMB%25'
        }
        if (campaignType !== 'all') {
          url += `&campaignTypeFilter=${encodeURIComponent(campaignType)}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch COAS data')
        }

        const result = await response.json()
        setCoasData(result.data)
        setLoading(false)
        setIsLoadingData(false)
      } catch (error) {
        console.error('Error loading COAS data:', error)
        setLoading(false)
        setIsLoadingData(false)
      }
    }

    loadCOASData()
  }, [dateRange, campaignCategory, campaignType, customStartDate, customEndDate])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading cost data...</div>
      </div>
    )
  }

  if (!coasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">Failed to load data</div>
      </div>
    )
  }

  const formatCurrency = (value, decimals = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  const channelNames = {
    'totalSpend': 'All Channels',
    'google': 'Google Ads',
    'bing': 'Bing Ads',
    'facebook': 'Facebook Ads'
  }

  // Icon and unit mappings for outcomes
  const outcomeIcons = {
    'meetingsCreated': '📆',
    'meetingsCompleted': '📅',
    'dealsCreated': '🤝',
    'dealsWon': '🏆',
    'newDealRevenue': '💰',
    'expansionDealRevenue': '📈',
    'renewalDealRevenue': '🔄',
    'totalRevenue': '💵',
    'businessAccounts': '🏢',
    'userAccounts': '👤',
    'businessCreated': '✨',
    'brandedSearch': '🔍',
    'organicSearch': '🌐',
    'directTraffic': '📍'
  }

  const outcomeUnits = {
    'meetingsCreated': 'meeting',
    'meetingsCompleted': 'meeting',
    'dealsCreated': 'deal',
    'dealsWon': 'deal',
    'newDealRevenue': 'revenue',
    'expansionDealRevenue': 'revenue',
    'renewalDealRevenue': 'revenue',
    'totalRevenue': 'revenue',
    'businessAccounts': 'account',
    'userAccounts': 'user',
    'businessCreated': 'business',
    'brandedSearch': 'click',
    'organicSearch': 'click',
    'directTraffic': 'user'
  }

  // Group outcomes by category for display
  const outcomeGroups = {
    'Sales Pipeline': ['meetingsCreated', 'meetingsCompleted', 'dealsCreated', 'dealsWon'],
    'Revenue': ['newDealRevenue', 'expansionDealRevenue', 'renewalDealRevenue', 'totalRevenue'],
    'Growth': ['businessCreated', 'businessAccounts', 'userAccounts']
  }

  // Get data for selected channel
  const correlations = coasData.correlations?.[selectedChannel] || {}
  const outcomes = coasData.outcomes || {}
  const summary = coasData.summary || {}

  // Get spend for selected channel
  const channelSpend = selectedChannel === 'totalSpend'
    ? summary.totalSpend
    : summary.channelBreakdown?.[selectedChannel] || 0

  // Get confidence label and color
  const getConfidence = (r, significant) => {
    const absR = Math.abs(r)
    if (significant && absR >= 0.6) return { label: 'High', class: 'text-green-400 bg-green-400/10 border-green-400' }
    if (significant && absR >= 0.4) return { label: 'Medium', class: 'text-yellow-400 bg-yellow-400/10 border-yellow-400' }
    return { label: 'Low', class: 'text-zinc-400 bg-zinc-400/10 border-zinc-400' }
  }

  // Calculate cost per outcome for each metric (dynamically from API data)
  const costPerOutcome = Object.entries(outcomes).map(([outcomeId, outcomeData]) => {
    const corrData = correlations[outcomeId]

    if (!outcomeData || !corrData?.bestCorr) return null

    const totalOutcomes = outcomeData.total
    const costPer = totalOutcomes > 0 ? channelSpend / totalOutcomes : 0
    const { bestCorr, bestLag } = corrData
    const confidence = getConfidence(bestCorr.r, bestCorr.significant)

    return {
      id: outcomeId,
      name: outcomeData.name,
      icon: outcomeIcons[outcomeId] || '📊',
      unit: outcomeUnits[outcomeId] || 'outcome',
      isCurrency: outcomeData.isCurrency || false,
      costPer,
      totalOutcomes,
      correlation: bestCorr.r,
      significant: bestCorr.significant,
      lag: bestLag,
      confidence
    }
  }).filter(Boolean)

  // Sort by confidence (high first) then by cost
  costPerOutcome.sort((a, b) => {
    const confOrder = { 'High': 0, 'Medium': 1, 'Low': 2 }
    if (confOrder[a.confidence.label] !== confOrder[b.confidence.label]) {
      return confOrder[a.confidence.label] - confOrder[b.confidence.label]
    }
    return a.costPer - b.costPer
  })

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        {/* Compact Header Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">Cost Per Outcome</h1>
              <p className="text-muted-foreground text-xs">
                {summary.months} months • {formatCurrency(channelSpend)} {campaignCategory === 'b2b' ? 'B2B' : 'total'}{campaignType !== 'all' ? ` ${campaignType}` : ''} spend
              </p>
            </div>
          </div>

          {/* Filters - compact row */}
          <div className="flex gap-3 items-center">
            {/* Channel selector */}
            <div className="flex gap-1">
              {['totalSpend', 'google', 'bing', 'facebook'].map(channel => (
                <button
                  key={channel}
                  onClick={() => setSelectedChannel(channel)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    selectedChannel === channel
                      ? 'bg-green-400/10 border border-green-400 text-green-400'
                      : 'bg-card border border-border text-muted-foreground hover:border-green-400/50'
                  }`}
                >
                  {channelNames[channel]}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-border" />

            {/* B2B / All toggle */}
            <div className="flex gap-1 bg-muted/30 rounded-md p-0.5">
              {[
                { value: 'b2b', label: 'B2B' },
                { value: 'all', label: 'All' }
              ].map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCampaignCategory(cat.value)}
                  disabled={isLoadingData}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    campaignCategory === cat.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-border" />

            {/* Campaign Type toggle (Video/Search/All) */}
            <div className="flex gap-1 bg-muted/30 rounded-md p-0.5">
              {[
                { value: 'all', label: 'All Types' },
                { value: 'video', label: 'Video' },
                { value: 'search', label: 'Search' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setCampaignType(type.value)}
                  disabled={isLoadingData}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    campaignType === type.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex gap-1 items-center">
              {[
                { value: '24m', label: '24m' },
                { value: '12m', label: '12m' },
                { value: 'custom', label: 'Custom' }
              ].map(range => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  disabled={isLoadingData}
                  className={`px-2 py-1 rounded-md text-xs transition-colors ${
                    dateRange === range.value
                      ? 'bg-green-400/10 border border-green-400 text-green-400'
                      : 'bg-card border border-border text-muted-foreground hover:border-green-400/50'
                  } disabled:opacity-50`}
                >
                  {range.label}
                </button>
              ))}
              {dateRange === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 rounded-md text-xs bg-card border border-border text-foreground ml-2"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 rounded-md text-xs bg-card border border-border text-foreground"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cost Per Outcome Cards - Grouped */}
        {Object.entries(outcomeGroups).map(([groupName, outcomeIds]) => {
          const groupOutcomes = outcomeIds
            .map(id => costPerOutcome.find(o => o.id === id))
            .filter(Boolean)

          if (groupOutcomes.length === 0) return null

          return (
            <div key={groupName} className="mb-6">
              <h2 className="text-sm font-medium mb-3 text-muted-foreground">{groupName}</h2>
              <div className="grid grid-cols-4 gap-3">
                {groupOutcomes.map(outcome => {
                  // For currency outcomes (revenue), show ROAS-style ratio instead of cost per
                  const isCurrencyOutcome = outcome.isCurrency
                  const displayValue = isCurrencyOutcome
                    ? (outcome.totalOutcomes / channelSpend).toFixed(2)
                    : formatCurrency(outcome.costPer)
                  const displayLabel = isCurrencyOutcome
                    ? `return per $1`
                    : `per ${outcome.unit}`
                  const totalDisplay = isCurrencyOutcome
                    ? formatCurrency(outcome.totalOutcomes)
                    : outcome.totalOutcomes.toLocaleString()

                  return (
                    <div key={outcome.id} className="bg-card border border-border rounded-lg p-3">
                      {/* Header: Icon + Name */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-lg">{outcome.icon}</div>
                        <div className="text-xs font-medium truncate">{outcome.name}</div>
                      </div>

                      {/* Main metric */}
                      <div className="mb-1">
                        <div className="text-xl font-bold">
                          {isCurrencyOutcome ? `$${displayValue}` : displayValue}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{displayLabel}</div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                        <span>{totalDisplay} total</span>
                        <span>{outcome.lag === 0 ? '0mo' : `${outcome.lag}mo`} lag</span>
                      </div>

                      {/* Confidence badge */}
                      <div className="pt-2 border-t border-border flex items-center">
                        <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${outcome.confidence.class}`}>
                          {outcome.confidence.label}
                        </div>
                        {outcome.correlation > 0 ? (
                          <span className="text-[10px] text-green-400 ml-2">+{outcome.correlation.toFixed(2)}</span>
                        ) : (
                          <span className="text-[10px] text-red-400 ml-2">{outcome.correlation.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Note about confidence */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <strong>Confidence:</strong> High = strong correlation (r ≥ 0.6, p &lt; 0.05). Low = weak/inconsistent relationship.
        </div>
      </div>
    </div>
  )
}

export default function MediaTrader() {
  const [activeFeature, setActiveFeature] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataSourceStatuses, setDataSourceStatuses] = useState({})

  // Load tool config from workspace on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const result = await window.electronAPI.api.getToolConfig('mediatrader')
        if (result.success) {
          setConfig(result.config)
        } else {
          console.error('Failed to load MediaTrader config:', result.error)
        }
      } catch (error) {
        console.error('Error loading MediaTrader config:', error)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  // Load data source stats dynamically
  useEffect(() => {
    async function loadDataSourceStats() {
      try {
        const response = await fetch('http://localhost:3000/api/mediatrader/datasource-stats')
        const result = await response.json()
        if (result.success && result.stats) {
          setDataSourceStatuses(result.stats)
        }
      } catch (error) {
        console.error('Error loading data source stats:', error)
      }
    }
    loadDataSourceStats()
  }, [])

  // Get tool name from config (defaults to "MediaTrader" for backwards compatibility)
  const toolName = config?.name || 'MediaTrader'

  // Show loading state while config loads
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading {toolName} configuration...</div>
      </div>
    )
  }

  // Show error if config failed to load
  if (!config) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">Failed to load {toolName} configuration</div>
      </div>
    )
  }

  // If a feature is active, show that feature view
  if (activeFeature === 'spend-analysis') {
    return <SpendAnalysis onBack={() => setActiveFeature(null)} config={config} toolName={toolName} />
  }

  if (activeFeature === 'signals') {
    return <SignalsView onBack={() => setActiveFeature(null)} config={config} toolName={toolName} />
  }

  if (activeFeature === 'media-correlation') {
    return <MediaCorrelation onBack={() => setActiveFeature(null)} config={config} toolName={toolName} />
  }

  if (activeFeature === 'mmm') {
    // Pass null for roasData/summary since MMM will load its own data
    return <MediaMixModeling onBack={() => setActiveFeature(null)} roasData={null} summary={null} />
  }

  return (
    <div className="h-full p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Features Section - Lead with what you can do */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Indicators</h2>
          <div className="grid grid-cols-4 gap-6">
            <div
              onClick={() => setActiveFeature('signals')}
              className="p-6 bg-card border border-border rounded-lg text-center hover:border-green-400 transition-colors cursor-pointer"
            >
              <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Signals</h3>
              <p className="text-sm text-muted-foreground">
                Weekly anomaly detection across all metrics
              </p>
            </div>
            <div
              onClick={() => setActiveFeature('spend-analysis')}
              className="p-6 bg-card border border-border rounded-lg text-center hover:border-green-400 transition-colors cursor-pointer"
            >
              <BarChart3 className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Correlation Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Correlate any input variable against outcomes
              </p>
            </div>
            <div
              onClick={() => setActiveFeature('media-correlation')}
              className="p-6 bg-card border border-border rounded-lg text-center hover:border-green-400 transition-colors cursor-pointer"
            >
              <DollarSign className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Media Correlation</h3>
              <p className="text-sm text-muted-foreground">
                COAS analysis with time-lagged correlation
              </p>
            </div>
            <div
              onClick={() => setActiveFeature('mmm')}
              className="p-6 bg-gradient-to-br from-green-400/5 to-blue-400/5 border border-green-400/30 rounded-lg text-center hover:border-green-400 transition-colors cursor-pointer"
            >
              <Sparkles className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1 flex items-center justify-center gap-2">
                <span>Media Mix Modeling</span>
                <span className="text-xs px-2 py-0.5 rounded border bg-blue-400/10 border-blue-400 text-blue-400">BETA</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                AI-powered spend optimization and predictions
              </p>
            </div>
          </div>
        </div>

        {/* Data Sources Section - Simple table view */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-muted-foreground">
            <Database className="h-5 w-5" />
            Data Sources
          </h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Size</th>
                  <th className="p-3 font-medium">Last Update</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Ad Channels */}
                {config.channels.filter(c => c.enabled).map(channel => {
                  const status = dataSourceStatuses[channel.id] || { fileSize: 'N/A', lastUpdate: 'N/A' }

                  return (
                    <tr key={channel.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{channel.name}</td>
                      <td className="p-3 text-sm text-muted-foreground capitalize">{channel.type}</td>
                      <td className="p-3 text-sm text-muted-foreground">{status.fileSize}</td>
                      <td className="p-3 text-sm text-muted-foreground">{status.lastUpdate}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span className="text-sm text-muted-foreground">Enabled</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Conversion/Outcome Sources */}
                {config.conversionSources.filter(s => s.enabled).map(source => {
                  const status = dataSourceStatuses[source.id] || { fileSize: 'N/A', lastUpdate: 'N/A' }

                  return (
                    <tr key={source.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{source.name}</td>
                      <td className="p-3 text-sm text-muted-foreground capitalize">{source.type}</td>
                      <td className="p-3 text-sm text-muted-foreground">{status.fileSize}</td>
                      <td className="p-3 text-sm text-muted-foreground">{status.lastUpdate}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <span className="text-sm text-muted-foreground">Enabled</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
