import { restBaseUrl, useOpenmrsFetchAll, type Concept } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { type Observation } from '../../types';
import { type TFunction } from 'i18next';
import { type ColoredObsTagConfig } from '../../config-schema';

// prettier-ignore
export const obsCustomRepresentation = 
  'custom:(uuid,display,obsDatetime,value,' + 
    'concept:(uuid,display),' + 
    'encounter:(uuid,display,encounterType,encounterDatetime,' + 
      'visit:(uuid,display)))';

//  get the setMembers of a concept set
const conceptSetCustomRepresentation = 'custom:(uuid,setMembers:(uuid))';

export function useConceptToTagColorMap(tags: Array<ColoredObsTagConfig> = []) {
  // The TacConfigObject allows us to specify the mapping of
  // concept sets to colors. However, we also need to build a map of
  // concepts to colors. This function does that.

  const tagsHash = JSON.stringify(tags);

  const { conceptSetToTagColorMap, conceptSetUuids } = useMemo(() => {
    const map = new Map<string, string>();
    const uuids: string[] = [];
    for (const tag of tags) {
      const { color, appliedToConceptSets } = tag;
      for (const answer of appliedToConceptSets ?? []) {
        if (!map.has(answer)) {
          map.set(answer, color);
        }
      }
      if (appliedToConceptSets) {
        // filter out null/undefined if present in appliedToConceptSets array just in case
        uuids.push(...appliedToConceptSets.filter(Boolean));
      }
    }
    return { conceptSetToTagColorMap: map, conceptSetUuids: uuids };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsHash]);

  const apiUrl = `${restBaseUrl}/concept?references=${conceptSetUuids.join()}&v=${conceptSetCustomRepresentation}`;
  const { data: conceptSets } = useOpenmrsFetchAll<Concept>(apiUrl);

  const conceptToTagColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (conceptSets) {
      for (const conceptSet of conceptSets) {
        for (const concept of conceptSet.setMembers) {
          if (!map.has(concept.uuid)) {
            const mappedColor = conceptSetToTagColorMap.get(conceptSet.uuid);
            if (mappedColor) {
                map.set(concept.uuid, mappedColor);
            }
          }
        }
      }
    }
    return map;
  }, [conceptSets, conceptSetToTagColorMap]);

  return conceptToTagColorMap;
}

export function getObsEncounterString(obs: Observation, t: TFunction) {
  return t('encounterDisplay', '{{encounterType}} {{encounterDate}}', {
    encounterType: obs.encounter.encounterType.display,
    encounterDate: new Date(obs.encounter.encounterDatetime).toLocaleDateString(),
    interpolation: { escapeValue: false },
  });
}
