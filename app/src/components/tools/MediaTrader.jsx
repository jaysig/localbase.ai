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
    'Website Traffic': [],
    'Paid Impressions': [],
    'Social Engagement': [],
    'HubSpot': [],
    'Revenue Stats': [],
    'Platform Stats': [],
    'Genie AI': [],
    'G2 Intent': [],
    'Mixpanel': []
  }

  variables.forEach(variable => {
    const id = variable.id
    const sourceType = variable.source?.type

    if (id === 'totalSpend' || id.startsWith('google-ads') || id.startsWith('facebook-ads') || id.startsWith('bing-ads')) {
      if (id.includes('impressions')) {
        groups['Paid Impressions'].push(variable)
      } else {
        groups['Ad Spend'].push(variable)
      }
    } else if (id.startsWith('organic-') || id.includes('direct-traffic')) {
      groups['Website Traffic'].push(variable)
    } else if (id.startsWith('youtube-') || id.startsWith('facebook-organic')) {
      groups['Social Engagement'].push(variable)
    } else if (sourceType === 'hubspot' || id.startsWith('hubspot-') || id.startsWith('meetings-')) {
      groups['HubSpot'].push(variable)
    } else if (id.startsWith('platform-revenue') || id.includes('revenue')) {
      groups['Revenue Stats'].push(variable)
    } else if (id.startsWith('platform-') || id.startsWith('trial-') || id.startsWith('active-') || id.startsWith('new-') || id.startsWith('paid-')) {
      groups['Platform Stats'].push(variable)
    } else if (id.startsWith('genie-')) {
      groups['Genie AI'].push(variable)
    } else if (id.startsWith('g2-')) {
      groups['G2 Intent'].push(variable)
    } else if (id.startsWith('mixpanel-')) {
      groups['Mixpanel'].push(variable)
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
function SignalsView({ onBack, config, toolName }) {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('all') // all, high, medium, low
  const [directionFilter, setDirectionFilter] = useState(null) // null, 'up', 'down'
  const [lastUpdated, setLastUpdated] = useState(null)

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
  async function refreshSignals() {
    if (!isBrowserMode) return

    setRefreshing(true)
    try {
      const res = await fetch('http://localhost:3000/api/signals/refresh', { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        // Reload the updated data
        await loadSignals()
      } else {
        console.error('Error refreshing signals:', result.error)
      }
    } catch (error) {
      console.error('Error refreshing signals:', error)
    }
    setRefreshing(false)
  }

  // Load signals on mount, auto-refresh in browser mode
  useEffect(() => {
    if (isBrowserMode) {
      // Browser mode: refresh data first, then load
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
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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
  const chartRef = useRef(null)
  const [lagMonths, setLagMonths] = useState(0)
  const [dataBySource, setDataBySource] = useState({}) // { sourceId: { name, data: [...] } }
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('matrix') // Start with matrix (chart needs refactoring)
  const [selectedInput, setSelectedInput] = useState('totalSpend') // Input variable selection
  const [visibleMetrics, setVisibleMetrics] = useState({}) // { metricId: boolean } for chart filtering
  const [useLogScale, setUseLogScale] = useState(false) // Log scale toggle for chart

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

  // Initialize visible metrics when inputOptions change
  useEffect(() => {
    if (inputOptions.length > 0 && Object.keys(visibleMetrics).length === 0) {
      const initial = {}
      inputOptions.forEach(v => {
        initial[v.id] = true // All visible by default
      })
      setVisibleMetrics(initial)
    }
  }, [inputOptions, visibleMetrics])

  // Load all data sources dynamically from config
  useEffect(() => {
    async function loadData() {
      if (!window.electronAPI?.mediatrader || !config) return

      try {
        const allSources = [...config.channels, ...config.conversionSources].filter(s => s.enabled)
        console.log(`📊 MediaTrader: Loading ${allSources.length} data sources from config`)

        const results = await Promise.all(
          allSources.map(async (source) => {
            const data = await window.electronAPI.mediatrader.queryDataSource({
              sourceId: source.id,
              options: { aggregation: source.costField ? 'sum' : (source.valueField ? 'sum' : 'count') }
            })
            return { id: source.id, name: source.name, data, source }
          })
        )

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
  }, [config])

  // Chart view disabled - correlation calculation and chart rendering removed
  // TODO: Refactor for config-driven data when re-enabling chart view

  // Chart rendering - simple multi-line chart showing all variables with dual Y-axes
  useEffect(() => {
    if (viewMode !== 'chart' || !chartRef.current || inputOptions.length === 0) return

    console.log('📊 Chart View - All Months:', allMonths)
    console.log('📊 Chart View - Input Options:', inputOptions.map(v => ({ label: v.label, dataPoints: v.data.length })))

    // Filter to only visible metrics
    const visibleVariables = inputOptions.filter(v => visibleMetrics[v.id])

    if (visibleVariables.length === 0) {
      chartRef.current.innerHTML = '<div class="text-center text-muted-foreground py-8">No metrics selected. Please select at least one metric to display.</div>'
      return
    }

    // Categorize variables into monetary vs count types
    const isMonetary = (label) => {
      const lowerLabel = label.toLowerCase()
      return lowerLabel.includes('spend') ||
             lowerLabel.includes('revenue') ||
             lowerLabel.includes('cost') ||
             lowerLabel.includes('amount')
    }

    // Build series with proper Y-axis assignments
    const series = []
    const colors = ['#4ade80', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#fbbf24', '#fb923c', '#f87171', '#06b6d4', '#a78bfa', '#f472b6', '#fb7185', '#fcd34d', '#34d399', '#60a5fa', '#c084fc']

    // Track which series use which axes for proper configuration
    let hasMonetary = false
    let hasCounts = false

    visibleVariables.forEach((variable, idx) => {
      const isMoney = isMonetary(variable.label)

      series.push({
        name: variable.label,
        type: 'line',
        data: variable.data,
        yAxisIndex: isMoney ? 0 : 1  // 0 = left (dollars), 1 = right (counts)
      })

      if (isMoney) hasMonetary = true
      else hasCounts = true
    })

    // Build Y-axis configurations
    const yaxisConfig = []

    // Calculate dynamic chart height based on legend items (25px per item, min 500px, max 1200px)
    const calculatedHeight = Math.max(500, Math.min(1200, 300 + (visibleVariables.length * 25)))

    // Add left Y-axis for monetary values if any exist
    if (hasMonetary) {
      yaxisConfig.push({
        logarithmic: useLogScale,
        title: {
          text: useLogScale ? 'Dollars ($) - Log Scale' : 'Dollars ($)',
          style: { color: '#9ca3af', fontSize: '12px' }
        },
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val) => val != null ? `$${Math.round(val)}` : '$0'
        }
      })
    }

    // Add right Y-axis for counts if any exist
    if (hasCounts) {
      yaxisConfig.push({
        logarithmic: useLogScale,
        opposite: true,
        title: {
          text: useLogScale ? 'Count - Log Scale' : 'Count',
          style: { color: '#9ca3af', fontSize: '12px' }
        },
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val) => val != null ? Math.round(val).toString() : '0'
        }
      })
    }

    const options = {
      chart: {
        type: 'line',
        height: calculatedHeight,
        background: 'transparent',
        toolbar: { show: false }
      },
      theme: { mode: 'dark' },
      series,
      colors: colors,
      xaxis: {
        categories: allMonths,
        labels: {
          style: { colors: '#9ca3af' },
          rotate: -45,
          rotateAlways: false
        }
      },
      yaxis: yaxisConfig,
      stroke: { width: 2, curve: 'smooth' },
      legend: {
        position: 'right',
        labels: { colors: '#9ca3af' }
      },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: {
          formatter: (val, opts) => {
            // Check if this series uses monetary axis (yAxisIndex 0)
            const series = opts.w.config.series[opts.seriesIndex]
            if (series && series.yAxisIndex === 0) {
              return `$${Math.round(val)}`
            } else {
              return Math.round(val).toString()
            }
          }
        }
      }
    }

    chartRef.current.innerHTML = ''
    const chart = new ApexCharts(chartRef.current, options)
    chart.render()

    return () => chart.destroy()
  }, [viewMode, inputOptions, allMonths, visibleMetrics, useLogScale])

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
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'chart'
                  ? 'bg-green-400/20 text-green-400 border border-green-400'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Chart
            </button>
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

        {viewMode === 'chart' ? (
          <div className="space-y-4">
            {/* Chart Controls */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold mb-1">Chart Controls</h3>
                  <p className="text-xs text-muted-foreground">
                    Filter metrics and adjust scale to improve chart readability
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useLogScale}
                    onChange={(e) => setUseLogScale(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-secondary"
                  />
                  <span className="text-sm font-medium">Logarithmic Scale</span>
                </label>
              </div>

              {/* Metric Filters - Grouped by Type in Columns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Visible Metrics</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const all = {}
                        inputOptions.forEach(v => { all[v.id] = true })
                        setVisibleMetrics(all)
                      }}
                      className="text-xs text-green-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={() => {
                        const none = {}
                        inputOptions.forEach(v => { none[v.id] = false })
                        setVisibleMetrics(none)
                      }}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Group variables by type - Multi-column layout */}
                {(() => {
                  const groups = groupVariables(inputOptions)
                  return (
                    <div className="grid grid-cols-5 gap-4">
                      {Object.entries(groups).filter(([_, vars]) => vars.length > 0).map(([groupName, variables]) => (
                        <div key={groupName} className="space-y-1.5">
                          <div className="text-xs font-bold text-muted-foreground pb-1 border-b border-border">
                            {groupName}
                          </div>
                          {variables.map(variable => (
                            <label key={variable.id} className="flex items-start gap-1.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={visibleMetrics[variable.id] || false}
                                onChange={(e) => setVisibleMetrics(prev => ({
                                  ...prev,
                                  [variable.id]: e.target.checked
                                }))}
                                className="w-3.5 h-3.5 mt-0.5 rounded border-border bg-secondary flex-shrink-0"
                              />
                              <span className="text-xs leading-tight group-hover:text-foreground text-muted-foreground">
                                {variable.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Chart Display */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold">All Variables Over Time</h3>
                <p className="text-xs text-muted-foreground">
                  Visual comparison of selected metrics. Use filters above to reduce clutter.
                </p>
              </div>
              <div ref={chartRef}></div>
            </div>
          </div>
        ) : viewMode === 'matrix' ? (
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

// Media Correlation - COAS Analysis
function MediaCorrelation({ onBack, config, toolName }) {
  const [roasData, setRoasData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState('all') // Default to all channels
  const [dateRange, setDateRange] = useState('12m') // all, 12m, 24m, 36m, custom
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [useLag, setUseLag] = useState(false) // Default to no lag for simpler view

  // Calculate date range for API call
  const getDateRange = () => {
    const today = new Date('2025-11-30') // Using latest data date
    const ranges = {
      '12m': [new Date(today.getFullYear() - 1, today.getMonth(), 1), today],
      '24m': [new Date(today.getFullYear() - 2, today.getMonth(), 1), today],
      '36m': [new Date(today.getFullYear() - 3, today.getMonth(), 1), today],
      'all': [new Date('2022-01-01'), today]
    }

    if (dateRange === 'custom') {
      return [new Date(customStartDate), new Date(customEndDate)]
    }

    return ranges[dateRange]
  }

  // Load ROAS data from API
  useEffect(() => {
    async function loadROASData() {
      setIsLoadingData(true)
      try {
        const [start, end] = getDateRange()
        const startDateStr = start.toISOString().split('T')[0]
        const endDateStr = end.toISOString().split('T')[0]

        const response = await fetch(`http://localhost:3000/api/media-correlation/roas?startDate=${startDateStr}&endDate=${endDateStr}&useLag=${useLag}`)

        if (!response.ok) {
          throw new Error('Failed to fetch ROAS data')
        }

        const result = await response.json()
        setRoasData(result.data)
        setSummary(result.summary)
        setLoading(false)
        setIsLoadingData(false)
      } catch (error) {
        console.error('Error loading ROAS data:', error)
        setLoading(false)
        setIsLoadingData(false)
      }
    }

    if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
      // Don't load if custom range selected but dates not set
      return
    }

    loadROASData()
  }, [dateRange, customStartDate, customEndDate, useLag])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading ROAS data...</div>
      </div>
    )
  }

  if (!roasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">Failed to load ROAS data</div>
      </div>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Get channel data based on selection
  const channelData = selectedChannel === 'all' ? roasData : { [selectedChannel]: roasData[selectedChannel] }
  const pipelines = ['New Deals', 'Renewal Deals', 'Expansion Deals']

  // Use summary data from API (avoids double-counting deals/revenue across channels)
  // Filter spend by channel if a specific channel is selected
  let totalSpend = 0
  let totalRevenue = summary?.totalRevenue || 0
  let totalDeals = summary?.totalDeals || 0
  let totalRoas = 0

  if (selectedChannel === 'all') {
    // Sum spend across all channels
    totalSpend = summary?.totalSpend || 0
    // Calculate average ROAS across all channel/pipeline combinations
    let roasSum = 0
    let roasCount = 0
    Object.values(roasData).forEach(channelPipelines => {
      Object.values(channelPipelines).forEach(metrics => {
        roasSum += metrics.roas
        roasCount++
      })
    })
    totalRoas = roasCount > 0 ? roasSum / roasCount : 0
  } else {
    // Get spend for the selected channel only (from first pipeline since spend is channel-level)
    const channelPipelines = roasData[selectedChannel]
    if (channelPipelines) {
      const firstPipeline = Object.values(channelPipelines)[0]
      totalSpend = firstPipeline?.spend || 0
      // Calculate average ROAS for this channel's pipelines
      let roasSum = 0
      let roasCount = 0
      Object.values(channelPipelines).forEach(metrics => {
        roasSum += metrics.roas
        roasCount++
      })
      totalRoas = roasCount > 0 ? roasSum / roasCount : 0
    }
  }

  // Calculate top performer from individual channel/pipeline combinations
  let topRoas = 0
  let topChannel = ''
  let topPipeline = ''
  let maxMonths = 0

  Object.entries(roasData).forEach(([channel, pipelines]) => {
    Object.entries(pipelines).forEach(([pipeline, metrics]) => {
      maxMonths = Math.max(maxMonths, metrics.months)

      if (metrics.roas > topRoas) {
        topRoas = metrics.roas
        topChannel = channel
        topPipeline = pipeline
      }
    })
  })

  const channelNames = {
    'google-ads': 'Google Ads',
    'bing-ads': 'Bing Ads',
    'facebook-ads': 'Facebook Ads'
  }

  // Get date range label
  const getDateRangeLabel = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30))
      return `${months} months`
    }

    const labels = {
      'all': '47 months',
      '36m': '36 months',
      '24m': '24 months',
      '12m': '12 months',
      'custom': 'Custom'
    }
    return labels[dateRange]
  }

  const getDateRangePeriod = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate.substring(0, 7)} → ${customEndDate.substring(0, 7)}`
    }

    const periods = {
      'all': '2022-01 → 2025-11',
      '36m': '2022-11 → 2025-11',
      '24m': '2023-11 → 2025-11',
      '12m': '2024-11 → 2025-11',
      'custom': 'Select dates'
    }
    return periods[dateRange]
  }

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
              <h1 className="text-3xl font-bold">Media Correlation</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {useLag ? 'Time-lagged correlation analysis' : 'Direct attribution (no lag)'} • NOT click-based
            </p>
          </div>

          {/* Lag Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Lag Analysis:</span>
            <button
              onClick={() => setUseLag(!useLag)}
              disabled={isLoadingData}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useLag ? 'bg-green-400' : 'bg-border'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useLag ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${useLag ? 'text-green-400' : 'text-muted-foreground'}`}>
              {useLag ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Summary Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Analysis Period</div>
            <div className="text-xl font-bold">{getDateRangeLabel()}</div>
            <div className="text-xs text-muted-foreground">{getDateRangePeriod()}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Spend</div>
            <div className="text-xl font-bold">{formatCurrency(totalSpend)}</div>
            <div className="text-xs text-muted-foreground">
              {selectedChannel === 'all' ? 'Across all channels' : channelNames[selectedChannel]}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Total COAS</div>
            <div className="text-xl font-bold">${totalRoas.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              {selectedChannel === 'all' ? 'Avg across channels' : channelNames[selectedChannel]}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Deals</div>
            <div className="text-xl font-bold">{totalDeals.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">B2B only (HubSpot)</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
            <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">B2B only (HubSpot)</div>
          </div>
        </div>

        {/* Channel and Date Range Filters */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedChannel('all')}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedChannel === 'all'
                  ? 'bg-green-400/10 border-green-400 text-green-400'
                  : 'bg-card border-border text-muted-foreground hover:border-green-400/50'
              }`}
            >
              All Channels
            </button>
            {Object.keys(roasData).map(channel => (
              <button
                key={channel}
                onClick={() => setSelectedChannel(channel)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  selectedChannel === channel
                    ? 'bg-green-400/10 border-green-400 text-green-400'
                    : 'bg-card border-border text-muted-foreground hover:border-green-400/50'
                }`}
              >
                {channelNames[channel]}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-muted-foreground">Date Range:</span>
            {[
              { value: 'all', label: 'All Time' },
              { value: '36m', label: 'Last 36mo' },
              { value: '24m', label: 'Last 24mo' },
              { value: '12m', label: 'Last 12mo' },
              { value: 'custom', label: 'Custom' }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                disabled={isLoadingData}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  dateRange === range.value
                    ? 'bg-green-400/10 border-green-400 text-green-400'
                    : 'bg-card border-border text-muted-foreground hover:border-green-400/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {range.label}
              </button>
            ))}

            {dateRange === 'custom' && (
              <div className="flex gap-2 items-center ml-4">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground"
                  min="2022-01-01"
                  max="2025-11-30"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground"
                  min="2022-01-01"
                  max="2025-11-30"
                />
              </div>
            )}

            {isLoadingData && (
              <span className="text-sm text-muted-foreground ml-2">Loading...</span>
            )}
          </div>
        </div>

        {/* COAS Cards Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {pipelines.map(pipeline => {
            // For "all channels", aggregate metrics across all channels
            let metrics
            if (selectedChannel === 'all') {
              // Calculate average ROAS and sum spend/revenue/deals across all channels for this pipeline
              const channels = Object.keys(roasData)
              const pipelineMetrics = channels.map(ch => roasData[ch][pipeline])

              metrics = {
                roas: pipelineMetrics.reduce((sum, m) => sum + m.roas, 0) / pipelineMetrics.length,
                revenue: pipelineMetrics[0].revenue, // Same across all channels
                spend: pipelineMetrics.reduce((sum, m) => sum + m.spend, 0), // Sum across channels
                deals: pipelineMetrics[0].deals, // Same across all channels
                lag: Math.round(pipelineMetrics.reduce((sum, m) => sum + m.lag, 0) / pipelineMetrics.length),
                confidence: pipelineMetrics[0].confidence, // Use first channel's confidence
                confScore: Math.round(pipelineMetrics.reduce((sum, m) => sum + m.confScore, 0) / pipelineMetrics.length)
              }
            } else {
              metrics = roasData[selectedChannel][pipeline]
            }

            const confidenceClass =
              metrics.confidence === 'high' ? 'bg-green-400/10 border-green-400 text-green-400' :
              metrics.confidence === 'medium' ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400' :
              'bg-red-400/10 border-red-400 text-red-400'

            return (
              <div key={pipeline} className="bg-card border border-border rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm text-muted-foreground font-medium">{pipeline}</div>
                  <div className={`px-2 py-1 rounded text-xs border ${confidenceClass}`}>
                    {metrics.confidence.toUpperCase()} {metrics.confScore}%
                  </div>
                </div>
                <div className="text-4xl font-bold mb-4">
                  ${metrics.roas.toFixed(2)} <span className="text-base font-normal text-muted-foreground">COAS</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spend:</span>
                    <span className="font-medium">{formatCurrency(metrics.spend)}</span>
                  </div>
                  {useLag && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Optimal Lag:</span>
                      <span className="font-medium">{metrics.lag} months</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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
