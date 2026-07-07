import type { GraphState } from '../graph.ts';

export function createListAppointmentsNode() {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`📋 Listing appointments (${state.appointmentsList?.length ?? 0} found)...`);

    return {
      actionSuccess: true,
    };
  };
}
