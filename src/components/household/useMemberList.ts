import { useEffect, useRef, useState } from "react";
import {
  newMember,
  nextMemberId,
  toggleSensitivity,
  updateMemberById,
  withActivityAdded,
  withActivityRemoved,
  withActivityUpdated,
} from "@/domain/household-edit";
import { LIMITS } from "@/domain/limits";
import type { HealthSensitivity, HouseholdMember, OutdoorActivity } from "@/domain/types";

/**
 * The household's members and every action that changes them. `version`
 * changes when the number fields must be redrawn from state, because those
 * fields are uncontrolled.
 */
export function useMemberList(initial: HouseholdMember[]) {
  const [members, setMembers] = useState<HouseholdMember[]>(initial);
  const [version, setVersion] = useState(0);
  // A new member card appears below the Add member button, often off screen, so move the cursor to it.
  const [memberToFocus, setMemberToFocus] = useState<string | null>(null);
  const nameInputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!memberToFocus) return;
    const input = nameInputs.current.get(memberToFocus);
    input?.focus();
    // Jump straight there: an animated scroll can make people who are sensitive to motion unwell.
    input?.scrollIntoView?.({ block: "center" });
    setMemberToFocus(null);
  }, [memberToFocus]);

  const editMember = (id: string, change: (m: HouseholdMember) => HouseholdMember) =>
    setMembers((prev) => updateMemberById(prev, id, change));

  return {
    members,
    version,
    /** Replace every member, for example from a sample household. */
    replaceMembers: (next: HouseholdMember[]) => {
      setMembers(next);
      setVersion((v) => v + 1);
    },
    addMember: () => {
      if (members.length >= LIMITS.maxMembers) return;
      const id = nextMemberId(members);
      setMemberToFocus(id);
      setMembers((prev) => (prev.length >= LIMITS.maxMembers ? prev : [...prev, newMember(id)]));
    },
    removeMember: (id: string) =>
      setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((m) => m.id !== id))),
    updateMember: (id: string, updates: Partial<HouseholdMember>) =>
      editMember(id, (m) => ({ ...m, ...updates })),
    toggleMemberSensitivity: (id: string, sensitivity: HealthSensitivity) =>
      editMember(id, (m) => ({
        ...m,
        sensitivities: toggleSensitivity(m.sensitivities, sensitivity),
      })),
    addActivity: (id: string) =>
      editMember(id, (m) => withActivityAdded(m, LIMITS.maxActivitiesPerMember)),
    updateActivity: (id: string, index: number, updates: Partial<OutdoorActivity>) =>
      editMember(id, (m) => withActivityUpdated(m, index, updates)),
    removeActivity: (id: string, index: number) => {
      editMember(id, (m) => withActivityRemoved(m, index));
      // Rows are keyed by position, so refresh the number fields to show the right values.
      setVersion((v) => v + 1);
    },
    /** Keep a reference to each member's name field so a new member can be focused. */
    registerNameInput: (id: string, el: HTMLInputElement | null) => {
      if (el) nameInputs.current.set(id, el);
      else nameInputs.current.delete(id);
    },
  };
}

/** Everything the form's member cards need to change a member. */
export type MemberActions = Omit<
  ReturnType<typeof useMemberList>,
  "members" | "version" | "replaceMembers" | "addMember"
>;
