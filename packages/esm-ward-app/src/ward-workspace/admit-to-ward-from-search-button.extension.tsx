import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tag } from '@carbon/react';
import {
  openmrsFetch,
  restBaseUrl,
  useFeatureFlag,
  type Visit,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { CheckmarkFilled } from '@carbon/react/icons';
import useSWRImmutable from 'swr/immutable';
import { useAssignedBedByPatient } from '../hooks/useAssignedBedByPatient';
import useRestPatient from '../hooks/useRestPatient';
import useWardLocation from '../hooks/useWardLocation';
import type { Bed, InpatientAdmission, WardPatient } from '../types';
import styles from './admit-to-ward-from-search-button.scss';

interface AdmitToWardFromSearchButtonProps {
  patientUuid: string;
  activeVisit: Visit;
  launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'];
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}

// prettier-ignore
const admissionRep =
    'custom:(visit,' +
    'patient:(uuid),' +
    'currentInpatientLocation,' +
    ')';

/**
 * Extension rendered in `active-visit-patient-search-actions-slot` inside the ward patient search panel.
 * Shows 'Admit patient' for patients with an active visit not yet admitted to this ward,
 * or an 'Already admitted' tag if they are already admitted at this location.
 * Renders the button immediately (no loading state) — admission/bed data loads silently in the background.
 */
const AdmitToWardFromSearchButton: React.FC<AdmitToWardFromSearchButtonProps> = ({
  patientUuid,
  activeVisit,
  launchChildWorkspace,
}) => {
  const { t } = useTranslation();
  const { location } = useWardLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // These fetch in background — we never block rendering on them
  const { patient } = useRestPatient(patientUuid);
  const { data: bedData } = useAssignedBedByPatient(patientUuid);
  const isBedManagementModuleInstalled = useFeatureFlag('bedmanagement-module');

  const admissionUrl = patientUuid
    ? `${restBaseUrl}/emrapi/inpatient/admission?v=${admissionRep}&patients=${patientUuid}`
    : null;
  const { data: admissionData, isLoading: isLoadingAdmission } = useSWRImmutable<
    { data: { results: InpatientAdmission[] } },
    Error
  >(admissionUrl, openmrsFetch);

  // Wait for admission data before rendering — avoids 'Admit patient' → 'Already admitted' flash
  if (isLoadingAdmission) {
    return null;
  }

  const inpatientAdmission = admissionData?.data?.results?.[0];
  const assignedBedDetail = bedData?.data?.results?.[0];
  const isAssignedBedAtCurrentLocation = assignedBedDetail?.physicalLocation?.uuid === location?.uuid;
  // Require both UUIDs to be truthy to avoid undefined === undefined false positive
  const isAdmittedToCurrentLocation = !!(
    location?.uuid && inpatientAdmission?.currentInpatientLocation?.uuid === location.uuid
  );
  if (isAdmittedToCurrentLocation) {
    return (
      <Tag className={styles.alreadyAdmittedTag} type="green" renderIcon={CheckmarkFilled}>
        {t('alreadyAdmitted', 'Already admitted')}
      </Tag>
    );
  }

  const handleAdmit = () => {
    const wardPatient: WardPatient = {
      patient,
      visit: activeVisit,
      bed: isAssignedBedAtCurrentLocation
        ? ({
            id: assignedBedDetail.bedId,
            bedNumber: assignedBedDetail.bedNumber,
            bedType: assignedBedDetail.bedType,
          } as Bed)
        : null,
      inpatientAdmission: inpatientAdmission ?? null,
      inpatientRequest: null,
    };

    setIsSubmitting(true);
    if (isBedManagementModuleInstalled && !wardPatient.bed) {
      launchChildWorkspace('admit-patient-form-workspace', { wardPatient });
    } else {
      launchChildWorkspace('create-admission-encounter-workspace', {
        selectedPatientUuid: patientUuid,
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Button
      aria-label={t('admitPatient', 'Admit patient')}
      disabled={isSubmitting}
      kind="primary"
      onClick={handleAdmit}>
      {t('admitPatient', 'Admit patient')}
    </Button>
  );
};

export default AdmitToWardFromSearchButton;
