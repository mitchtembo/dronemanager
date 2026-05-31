import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  PlaneTakeoff,
  Save,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { parseNumber } from '../../lib/droneLifecycle';

const steps = [
  { id: 'identity', label: 'Identity', Icon: PlaneTakeoff },
  { id: 'compliance', label: 'Compliance', Icon: ShieldCheck },
  { id: 'technical', label: 'Technical', Icon: Cpu },
  { id: 'maintenance', label: 'Maintenance', Icon: Wrench },
];

const defaultForm = {
  registrationNumber: '',
  manufacturer: '',
  model: '',
  droneType: 'Multirotor',
  serialNumber: '',
  purchaseDate: '',
  homeBase: '',
  insurancePolicy: '',
  insuranceExpiry: '',
  certificationReference: '',
  payloadCapacityKg: '',
  maxFlightTimeMinutes: '',
  batteryType: '',
  firmwareVersion: '',
  status: 'Operational',
  readinessStatus: 'Ready',
  nextMaintenanceDate: '',
  maintenanceIntervalHours: '25',
  warrantyExpiry: '',
  maintenanceNotes: '',
};

const inputClass = 'w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent';

const splitModel = (drone) => {
  const manufacturer = drone?.manufacturer || '';
  const model = drone?.model || '';

  if (manufacturer && model.toLowerCase().startsWith(`${manufacturer} `.toLowerCase())) {
    return model.slice(manufacturer.length).trim();
  }

  return model;
};

const adaptReadinessForStatus = (status, readiness) => {
  if (status === 'Maintenance') return 'Needs Maintenance';
  if (status === 'Grounded') return 'Grounded';
  if (status === 'Decommissioned') return 'Decommissioned';
  return ['Ready', 'Assigned', 'In Mission', 'Needs Maintenance'].includes(readiness) ? readiness : 'Ready';
};

const Field = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
      {label}{required && ' *'}
    </label>
    {children}
    {error && (
      <p className="flex items-center gap-1 text-xs text-status-danger">
        <AlertCircle size={12} />
        {error}
      </p>
    )}
  </div>
);

const DroneFormModal = ({ isOpen, onClose, drone = null, onSave }) => {
  const isEditing = !!drone;
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (drone) {
      setForm({
        registrationNumber: drone.registration_number || drone.serial_number || '',
        manufacturer: drone.manufacturer || '',
        model: splitModel(drone),
        droneType: drone.drone_type || 'Multirotor',
        serialNumber: drone.serial_number || '',
        purchaseDate: drone.purchase_date || '',
        homeBase: drone.home_base || '',
        insurancePolicy: drone.insurance_policy || '',
        insuranceExpiry: drone.insurance_expiry || '',
        certificationReference: drone.certification_reference || '',
        payloadCapacityKg: drone.payload_capacity_kg ?? '',
        maxFlightTimeMinutes: drone.max_flight_time_minutes ?? '',
        batteryType: drone.battery_type || '',
        firmwareVersion: drone.firmware_version || '',
        status: drone.status || 'Operational',
        readinessStatus: drone.readiness_status || 'Ready',
        nextMaintenanceDate: drone.next_maintenance_date || '',
        maintenanceIntervalHours: drone.maintenance_interval_hours ?? '25',
        warrantyExpiry: drone.warranty_expiry || '',
        maintenanceNotes: drone.maintenance_notes || '',
      });
    } else {
      setForm(defaultForm);
    }

    setActiveStep(0);
    setErrors({});
  }, [drone, isOpen]);

  const currentStep = steps[activeStep];
  const safeReadiness = useMemo(
    () => adaptReadinessForStatus(form.status, form.readinessStatus),
    [form.status, form.readinessStatus],
  );

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.registrationNumber.trim()) nextErrors.registrationNumber = 'Registration number is required.';
    if (!form.manufacturer.trim()) nextErrors.manufacturer = 'Manufacturer is required.';
    if (!form.model.trim()) nextErrors.model = 'Model is required.';
    if (!form.serialNumber.trim()) nextErrors.serialNumber = 'Serial number is required.';
    if (!form.purchaseDate) nextErrors.purchaseDate = 'Purchase date is required.';
    if (!form.maintenanceIntervalHours || parseNumber(form.maintenanceIntervalHours, 0) <= 0) {
      nextErrors.maintenanceIntervalHours = 'Enter a positive service interval.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      const firstError = ['registrationNumber', 'manufacturer', 'model', 'serialNumber', 'purchaseDate'].find((key) => errors[key]);
      if (firstError) setActiveStep(firstError === 'purchaseDate' ? 0 : 0);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      registration_number: form.registrationNumber.trim(),
      manufacturer: form.manufacturer.trim(),
      model: `${form.manufacturer.trim()} ${form.model.trim()}`.trim(),
      drone_type: form.droneType,
      serial_number: form.serialNumber.trim(),
      purchase_date: form.purchaseDate || null,
      home_base: form.homeBase.trim() || null,
      insurance_policy: form.insurancePolicy.trim() || null,
      insurance_expiry: form.insuranceExpiry || null,
      certification_reference: form.certificationReference.trim() || null,
      payload_capacity_kg: parseNumber(form.payloadCapacityKg),
      max_flight_time_minutes: parseNumber(form.maxFlightTimeMinutes),
      battery_type: form.batteryType.trim() || null,
      firmware_version: form.firmwareVersion.trim() || null,
      status: form.status,
      readiness_status: safeReadiness,
      next_maintenance_date: form.nextMaintenanceDate || null,
      maintenance_interval_hours: parseNumber(form.maintenanceIntervalHours, 25),
      warranty_expiry: form.warrantyExpiry || null,
      maintenance_notes: form.maintenanceNotes.trim() || null,
    };

    const request = isEditing
      ? supabase.from('drones').update(payload).eq('id', drone.id)
      : supabase.from('drones').insert([payload]);

    const { error } = await request;
    setIsSubmitting(false);

    if (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save drone');
      return;
    }

    toast.success(isEditing ? 'Drone updated' : 'Drone onboarded');
    onSave?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-bg-elevated shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-text-primary">
              {isEditing ? 'Edit Drone Profile' : 'Drone Onboarding'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">Build the asset profile, compliance record, and maintenance baseline.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.Icon;
              const isActive = index === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`flex items-center gap-2 rounded border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActive
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border bg-bg-primary text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Icon size={15} />
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {currentStep.id === 'identity' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Registration Number" required error={errors.registrationNumber}>
                <input value={form.registrationNumber} onChange={(e) => updateForm('registrationNumber', e.target.value)} className={inputClass} placeholder="DSZ-DJI-005" />
              </Field>
              <Field label="Serial Number" required error={errors.serialNumber}>
                <input value={form.serialNumber} onChange={(e) => updateForm('serialNumber', e.target.value)} className={inputClass} placeholder="Manufacturer serial number" />
              </Field>
              <Field label="Manufacturer" required error={errors.manufacturer}>
                <input value={form.manufacturer} onChange={(e) => updateForm('manufacturer', e.target.value)} className={inputClass} placeholder="DJI" />
              </Field>
              <Field label="Model" required error={errors.model}>
                <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} className={inputClass} placeholder="Matrice 300 RTK" />
              </Field>
              <Field label="Drone Type">
                <select value={form.droneType} onChange={(e) => updateForm('droneType', e.target.value)} className={inputClass}>
                  <option value="Multirotor">Multirotor</option>
                  <option value="Fixed Wing">Fixed Wing</option>
                  <option value="VTOL">VTOL</option>
                  <option value="Payload Carrier">Payload Carrier</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Purchase Date" required error={errors.purchaseDate}>
                <input type="date" value={form.purchaseDate} onChange={(e) => updateForm('purchaseDate', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Home Base">
                <input value={form.homeBase} onChange={(e) => updateForm('homeBase', e.target.value)} className={inputClass} placeholder="Gweru Operations Yard" />
              </Field>
              <Field label="Warranty Expiry">
                <input type="date" value={form.warrantyExpiry} onChange={(e) => updateForm('warrantyExpiry', e.target.value)} className={inputClass} />
              </Field>
            </div>
          )}

          {currentStep.id === 'compliance' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Insurance Policy">
                <input value={form.insurancePolicy} onChange={(e) => updateForm('insurancePolicy', e.target.value)} className={inputClass} placeholder="Policy number" />
              </Field>
              <Field label="Insurance Expiry">
                <input type="date" value={form.insuranceExpiry} onChange={(e) => updateForm('insuranceExpiry', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Certification Reference">
                <input value={form.certificationReference} onChange={(e) => updateForm('certificationReference', e.target.value)} className={inputClass} placeholder="CAA/RPAS certificate reference" />
              </Field>
              <Field label="Operational Status">
                <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className={inputClass}>
                  <option value="Operational">Operational</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Grounded">Grounded</option>
                  <option value="Decommissioned">Decommissioned</option>
                </select>
              </Field>
              <Field label="Readiness">
                <select
                  value={safeReadiness}
                  onChange={(e) => updateForm('readinessStatus', e.target.value)}
                  disabled={form.status !== 'Operational'}
                  className={`${inputClass} ${form.status !== 'Operational' ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="Ready">Ready</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Mission">In Mission</option>
                  <option value="Needs Maintenance">Needs Maintenance</option>
                </select>
              </Field>
            </div>
          )}

          {currentStep.id === 'technical' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Payload Capacity (kg)">
                <input type="number" min="0" step="0.1" value={form.payloadCapacityKg} onChange={(e) => updateForm('payloadCapacityKg', e.target.value)} className={inputClass} placeholder="2.5" />
              </Field>
              <Field label="Max Flight Time (min)">
                <input type="number" min="1" value={form.maxFlightTimeMinutes} onChange={(e) => updateForm('maxFlightTimeMinutes', e.target.value)} className={inputClass} placeholder="45" />
              </Field>
              <Field label="Battery Type">
                <input value={form.batteryType} onChange={(e) => updateForm('batteryType', e.target.value)} className={inputClass} placeholder="TB60 / LiPo" />
              </Field>
              <Field label="Firmware Version">
                <input value={form.firmwareVersion} onChange={(e) => updateForm('firmwareVersion', e.target.value)} className={inputClass} placeholder="v01.00.0600" />
              </Field>
            </div>
          )}

          {currentStep.id === 'maintenance' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Service Interval (hours)" required error={errors.maintenanceIntervalHours}>
                <input type="number" min="1" step="0.5" value={form.maintenanceIntervalHours} onChange={(e) => updateForm('maintenanceIntervalHours', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Next Maintenance Date">
                <input type="date" value={form.nextMaintenanceDate} onChange={(e) => updateForm('nextMaintenanceDate', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Maintenance Notes">
                <textarea value={form.maintenanceNotes} onChange={(e) => updateForm('maintenanceNotes', e.target.value)} rows={5} className={`${inputClass} md:col-span-2 resize-none`} placeholder="Baseline condition, accessories, open service items..." />
              </Field>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Step <span className="font-data text-text-primary">{activeStep + 1}</span> of {steps.length}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
              disabled={activeStep === 0}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-semibold text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}
                className="inline-flex items-center gap-2 rounded border border-accent/30 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                Next
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <Save size={16} />}
                {isEditing ? 'Save Drone' : 'Complete Onboarding'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DroneFormModal;
