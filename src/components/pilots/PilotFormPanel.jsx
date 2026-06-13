import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, CalendarCheck, CheckCircle2, Copy, IdCard, MapPin, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { PILOT_READINESS_STATUSES } from '../../lib/pilotLifecycle';

const optionalText = z.string().optional().or(z.literal(''));
const PILOT_EMAIL_DOMAIN = 'dronesolutions.co.zw';

const pilotSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: optionalText,
  pilotCode: optionalText,
  baseLocation: optionalText,
  licenceNo: z.string().regex(/^CAAZ-RP-\d{4}$/, 'Must be format CAAZ-RP-XXXX'),
  category: z.enum(['RPAS-01', 'RPAS-02', 'RPAS-03']),
  licenceExpiry: z.string().min(1, 'Licence expiry date is required'),
  medicalExpiry: z.string().min(1, 'Medical expiry date is required'),
  status: z.enum(['Active', 'Suspended', 'Inactive']),
  readinessStatus: z.enum(PILOT_READINESS_STATUSES),
  lastCurrencyCheck: optionalText,
  nextCurrencyCheck: optionalText,
  minimumCurrencyHours: optionalText,
  lastTrainingDate: optionalText,
  nextTrainingDate: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  pilotNotes: optionalText,
  lastGroundedReason: optionalText,
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  confirmPassword: optionalText,
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) return false;
  return true;
}, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const emptyDefaults = {
  fullName: '',
  email: '',
  phone: '',
  pilotCode: '',
  baseLocation: '',
  licenceNo: '',
  category: 'RPAS-01',
  licenceExpiry: '',
  medicalExpiry: '',
  status: 'Active',
  readinessStatus: 'Ready',
  lastCurrencyCheck: '',
  nextCurrencyCheck: '',
  minimumCurrencyHours: '2',
  lastTrainingDate: '',
  nextTrainingDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  pilotNotes: '',
  lastGroundedReason: '',
  password: '',
  confirmPassword: '',
};

const panelField = 'w-full bg-bg-primary border border-border text-text-primary px-3 py-2 rounded font-sans text-sm focus:outline-none focus:border-accent transition-colors';

const ErrorText = ({ error }) => (
  error ? <p className="mt-1 flex items-center gap-1 text-xs text-status-danger"><AlertCircle size={12} />{error.message}</p> : null
);

const SectionTitle = ({ Icon, children }) => (
  <h3 className="flex items-center gap-2 border-b border-border/50 pb-2 font-sans text-xs font-semibold uppercase tracking-widest text-accent">
    <Icon size={15} />
    {children}
  </h3>
);

const toNullable = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
};

const deriveReadiness = (status, readiness) => {
  if (status === 'Inactive') return 'Inactive';
  if (status === 'Suspended') return 'Grounded';
  return readiness || 'Ready';
};

const getPilotEmailFromName = (fullName) => {
  const localPart = String(fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .join('')
    .replace(/[^a-z0-9]/g, '');

  return localPart ? `${localPart}@${PILOT_EMAIL_DOMAIN}` : '';
};

const generateInitialPassword = () => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const allCharacters = uppercase + lowercase + digits + symbols;
  const randomIndex = (length) => {
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  };
  const required = [uppercase, lowercase, digits, symbols].map((set) => set[randomIndex(set.length)]);

  const remaining = Array.from({ length: 8 }, () => allCharacters[randomIndex(allCharacters.length)]);
  return [...required, ...remaining].sort(() => randomIndex(3) - 1).join('');
};

const PilotFormPanel = ({ isOpen, onClose, pilot = null, onSave }) => {
  const isEditing = !!pilot;
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copyState, setCopyState] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(pilotSchema),
    defaultValues: emptyDefaults,
  });

  const watchedFullName = watch('fullName');

  useEffect(() => {
    if (pilot) {
      reset({
        fullName: pilot.full_name || '',
        email: pilot.email || '',
        phone: pilot.phone || '',
        pilotCode: pilot.pilot_code || pilot.licence_number || '',
        baseLocation: pilot.base_location || '',
        licenceNo: pilot.licence_number || '',
        category: pilot.category || 'RPAS-01',
        licenceExpiry: pilot.licence_expiry || '',
        medicalExpiry: pilot.medical_expiry || '',
        status: pilot.status || 'Active',
        readinessStatus: pilot.readiness_status || 'Ready',
        lastCurrencyCheck: pilot.last_currency_check || '',
        nextCurrencyCheck: pilot.next_currency_check || '',
        minimumCurrencyHours: String(pilot.minimum_currency_hours ?? 2),
        lastTrainingDate: pilot.last_training_date || '',
        nextTrainingDate: pilot.next_training_date || '',
        emergencyContactName: pilot.emergency_contact_name || '',
        emergencyContactPhone: pilot.emergency_contact_phone || '',
        pilotNotes: pilot.pilot_notes || '',
        lastGroundedReason: pilot.last_grounded_reason || '',
        password: '',
        confirmPassword: '',
      });
    } else {
      const generatedPassword = generateInitialPassword();
      reset({
        ...emptyDefaults,
        password: generatedPassword,
        confirmPassword: generatedPassword,
      });
    }
    setCopyState('');
  }, [pilot, isOpen, reset]);

  useEffect(() => {
    if (isEditing) return;
    const generatedEmail = getPilotEmailFromName(watchedFullName);
    setValue('email', generatedEmail, { shouldDirty: true, shouldValidate: !!generatedEmail });
  }, [isEditing, setValue, watchedFullName]);

  const buildProfilePayload = (data) => ({
    full_name: data.fullName.trim(),
    role: 'pilot',
    email: toNullable(data.email),
    phone: toNullable(data.phone),
    pilot_code: toNullable(data.pilotCode) || data.licenceNo,
    base_location: toNullable(data.baseLocation),
    licence_number: data.licenceNo.trim(),
    category: data.category,
    status: data.status,
    readiness_status: deriveReadiness(data.status, data.readinessStatus),
    licence_expiry: data.licenceExpiry,
    medical_expiry: data.medicalExpiry,
    last_currency_check: toNullable(data.lastCurrencyCheck),
    next_currency_check: toNullable(data.nextCurrencyCheck),
    minimum_currency_hours: data.minimumCurrencyHours ? Number(data.minimumCurrencyHours) : 2,
    last_training_date: toNullable(data.lastTrainingDate),
    next_training_date: toNullable(data.nextTrainingDate),
    emergency_contact_name: toNullable(data.emergencyContactName),
    emergency_contact_phone: toNullable(data.emergencyContactPhone),
    pilot_notes: toNullable(data.pilotNotes),
    last_grounded_reason: toNullable(data.lastGroundedReason),
  });

  const markInitialPasswordRequired = async (pilotId) => {
    if (!pilotId) return;

    const { error } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', pilotId);

    if (error) {
      console.warn('Unable to set must_change_password on profile. Confirm the column exists in Supabase.', error);
    }
  };

  const onSubmit = async (data) => {
    try {
      const generatedEmail = getPilotEmailFromName(data.fullName);
      const generatedPassword = data.password || generateInitialPassword();
      const submission = {
        ...data,
        email: isEditing ? data.email : generatedEmail,
        password: generatedPassword,
        confirmPassword: generatedPassword,
      };

      if (!isEditing && !submission.email) {
        toast.error('Enter the pilot full name to generate their email address.');
        return;
      }

      const payload = buildProfilePayload(submission);

      if (isEditing) {
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', pilot.id);
        if (error) throw error;
      } else {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'create_verified_pilot',
          {
            body: {
              email: submission.email,
              password: submission.password,
              fullName: submission.fullName,
              licenceNo: submission.licenceNo,
              category: submission.category,
              licenceExpiry: submission.licenceExpiry,
              medicalExpiry: submission.medicalExpiry,
              status: submission.status,
              mustChangePassword: true,
            },
          }
        );

        if (fnError) throw new Error(`Pilot creation failed: ${fnError.message}`);
        if (!fnData?.success) throw new Error(fnData?.error || 'Unknown error during pilot creation');

        const createdPilotId = fnData?.user?.id || fnData?.profile?.id || fnData?.data?.user?.id || fnData?.id;
        let updateQuery = supabase.from('profiles').update(payload);
        updateQuery = createdPilotId ? updateQuery.eq('id', createdPilotId) : updateQuery.eq('licence_number', data.licenceNo);

        const { error: enrichError } = await updateQuery;
        if (enrichError) throw enrichError;

        if (createdPilotId) {
          await markInitialPasswordRequired(createdPilotId);
        } else {
          const { data: createdProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', submission.email)
            .maybeSingle();
          await markInitialPasswordRequired(createdProfile?.id);
        }

        setCreatedCredentials({
          fullName: submission.fullName.trim(),
          email: submission.email,
          password: submission.password,
        });
      }

      if (onSave) onSave(submission);
      toast.success(isEditing ? 'Pilot updated successfully' : 'Pilot added and verified');
      if (isEditing) {
        onClose();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'An error occurred while saving');
    }
  };

  const copyCredentials = async () => {
    if (!createdCredentials) return;

    const text = [
      `Pilot: ${createdCredentials.fullName}`,
      `Email: ${createdCredentials.email}`,
      `Temporary password: ${createdCredentials.password}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('Copied');
      setTimeout(() => setCopyState(''), 1800);
    } catch (error) {
      console.error(error);
      toast.error('Unable to copy details. Select and copy them manually.');
    }
  };

  const closeSuccessModal = () => {
    setCreatedCredentials(null);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-bg-primary/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-bg-elevated shadow-2xl transition-transform duration-300 ease-in-out sm:w-[620px] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="font-heading text-xl uppercase tracking-wider text-text-primary">
              {isEditing ? 'Edit Pilot Profile' : 'Register New Pilot'}
            </h2>
            <p className="mt-1 text-sm text-text-muted">Identity, certification, readiness, and currency.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
          <form id="pilot-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {!isEditing && (
              <>
                <input type="hidden" {...register('email')} />
                <input type="hidden" {...register('password')} />
                <input type="hidden" {...register('confirmPassword')} />
              </>
            )}

            <section className="space-y-4">
              <SectionTitle Icon={UserRound}>Identity</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-text-secondary">Full Name</label>
                  <input {...register('fullName')} className={panelField} placeholder="e.g. John Doe" />
                  <ErrorText error={errors.fullName} />
                </div>
                {isEditing && (
                  <div>
                    <label className="mb-1 block text-xs text-text-secondary">Email Address</label>
                    <input type="email" {...register('email')} className={panelField} placeholder={`johndoe@${PILOT_EMAIL_DOMAIN}`} readOnly />
                    <ErrorText error={errors.email} />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Contact Phone</label>
                  <input {...register('phone')} className={panelField} placeholder="+263 77 000 0000" />
                  <ErrorText error={errors.phone} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Pilot Code</label>
                  <input {...register('pilotCode')} className={panelField} placeholder="OPS-PIL-001" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Home Base</label>
                  <input {...register('baseLocation')} className={panelField} placeholder="Harare Operations Hub" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle Icon={IdCard}>CAAZ Credentials</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Licence Number</label>
                  <input {...register('licenceNo')} className={`${panelField} font-data`} placeholder="CAAZ-RP-0000" />
                  <ErrorText error={errors.licenceNo} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Licence Category</label>
                  <select {...register('category')} className={`${panelField} appearance-none`}>
                    <option value="RPAS-01">RPAS-01</option>
                    <option value="RPAS-02">RPAS-02</option>
                    <option value="RPAS-03">RPAS-03</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Licence Expiry</label>
                  <input type="date" {...register('licenceExpiry')} className={`${panelField} font-data [color-scheme:dark]`} />
                  <ErrorText error={errors.licenceExpiry} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Medical Expiry</label>
                  <input type="date" {...register('medicalExpiry')} className={`${panelField} font-data [color-scheme:dark]`} />
                  <ErrorText error={errors.medicalExpiry} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle Icon={CalendarCheck}>Currency</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Last Currency Check</label>
                  <input type="date" {...register('lastCurrencyCheck')} className={`${panelField} font-data [color-scheme:dark]`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Next Currency Check</label>
                  <input type="date" {...register('nextCurrencyCheck')} className={`${panelField} font-data [color-scheme:dark]`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Minimum Recent Hours</label>
                  <input type="number" step="0.1" min="0" {...register('minimumCurrencyHours')} className={`${panelField} font-data`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Last Training</label>
                  <input type="date" {...register('lastTrainingDate')} className={`${panelField} font-data [color-scheme:dark]`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-text-secondary">Next Training</label>
                  <input type="date" {...register('nextTrainingDate')} className={`${panelField} font-data [color-scheme:dark]`} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle Icon={ShieldCheck}>Readiness</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Account Status</label>
                  <select {...register('status')} className={`${panelField} appearance-none`}>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Readiness Status</label>
                  <select {...register('readinessStatus')} className={`${panelField} appearance-none`}>
                    {PILOT_READINESS_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-text-secondary">Grounding Reason</label>
                  <input {...register('lastGroundedReason')} className={panelField} placeholder="Reason if grounded or suspended" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle Icon={MapPin}>Emergency Contact</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Contact Name</label>
                  <input {...register('emergencyContactName')} className={panelField} placeholder="Next of kin or supervisor" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Contact Phone</label>
                  <input {...register('emergencyContactPhone')} className={panelField} placeholder="+263 77 000 0000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-text-secondary">Pilot Notes</label>
                  <textarea {...register('pilotNotes')} rows={4} className={`${panelField} resize-none`} placeholder="Operational notes, limits, or endorsements" />
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-bg-elevated p-6">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 font-sans text-sm font-semibold uppercase text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
            type="button"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pilot-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2 font-sans text-sm font-semibold uppercase text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : (
              <Save size={16} />
            )}
          {isEditing ? 'Save Changes' : 'Register Pilot'}
          </button>
        </div>
      </div>

      {createdCredentials && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-primary/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-border bg-bg-elevated p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-status-success/10 text-status-success">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold uppercase tracking-wide text-text-primary">Pilot Created</h3>
                <p className="mt-1 text-sm text-text-muted">Copy these login details before closing this window.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded border border-border bg-bg-primary p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pilot</div>
                <div className="mt-1 text-sm font-semibold text-text-primary">{createdCredentials.fullName}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Email</div>
                <div className="mt-1 break-all font-data text-sm text-text-primary">{createdCredentials.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Temporary Password</div>
                <div className="mt-1 break-all font-data text-sm text-text-primary">{createdCredentials.password}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={copyCredentials}
                className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
              >
                <Copy size={16} />
                {copyState || 'Copy Details'}
              </button>
              <button
                type="button"
                onClick={closeSuccessModal}
                className="rounded bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PilotFormPanel;
