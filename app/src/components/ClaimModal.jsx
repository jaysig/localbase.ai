import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

const API_BASE = 'http://localhost:3000'

/**
 * ClaimModal - Modal form for claiming/adding a business listing
 * Pre-fills from an existing business object (e.g. Foursquare result) when available
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Called when modal closes
 * @param {Function} props.onSuccess - Called after successful submission with the new claim
 * @param {Object} [props.business] - Optional business to pre-fill from (search result)
 */
export default function ClaimModal({ open, onClose, onSuccess, business }) {
  const [form, setForm] = useState({
    business_name: business?.name || '',
    contact_name: '',
    email: '',
    phone: business?.phone || '',
    website: business?.website || '',
    address: business?.address || '',
    city: business?.city || '',
    state: business?.state || '',
    zip_code: business?.zip_code || '',
    category: business?.category || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch(`${API_BASE}/api/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit claim')
      }

      setSuccess(true)
      onSuccess?.(data.claim)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {business ? 'Claim This Business' : 'Add Your Business'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <p className="text-green-400 font-medium mb-2">Claim submitted!</p>
            <p className="text-sm text-muted-foreground mb-4">
              Your business listing is pending review.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Business Name */}
            <div>
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={handleChange('business_name')}
                required
                placeholder="Acme Roofing"
              />
            </div>

            {/* Contact Name */}
            <div>
              <Label htmlFor="contact_name">Your Name</Label>
              <Input
                id="contact_name"
                value={form.contact_name}
                onChange={handleChange('contact_name')}
                placeholder="John Smith"
              />
            </div>

            {/* Email + Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="john@acme.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={handleChange('website')}
                placeholder="https://acmeroofing.com"
              />
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={handleChange('address')}
                placeholder="123 Main St"
              />
            </div>

            {/* City, State, Zip row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={handleChange('city')}
                  placeholder="Indianapolis"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={handleChange('state')}
                  placeholder="IN"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="zip_code">Zip</Label>
                <Input
                  id="zip_code"
                  value={form.zip_code}
                  onChange={handleChange('zip_code')}
                  placeholder="46204"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={handleChange('category')}
                placeholder="Roofing, General Contractor"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
