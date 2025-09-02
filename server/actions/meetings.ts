'use server'

import { db } from "@/drizzle/db";
import { meetingActionSchema } from "@/schema/meetings";
import { fromZonedTime } from "date-fns-tz";
import { getValidTimesFromSchedule } from "./schedule";
import { createCalendarEvent } from "../google/googleCalender";
import { z } from "zod";

export async function createMeeting(
    unsafeData: z.infer<typeof meetingActionSchema> 
) {


    try {
       
        const { success, data } = meetingActionSchema.safeParse(unsafeData);

    
        if (!success) {
            throw new Error("Invalid data.");
        }

    
        const event = await db.query.EventTable.findFirst({
            where: ({ clerkUserId, isActive, id }, { eq, and }) =>
                and(
                    eq(isActive, true), 
                    eq(clerkUserId, data.clerkUserId),
                    eq(id, data.eventId) 
                ),
        });

 
        if (!event) {
            throw new Error("Event not found.");
        }

        
        const startInTimezone = fromZonedTime(data.startTime, data.timezone);

      
        const validTimes = await getValidTimesFromSchedule([startInTimezone], event);

       
        if (validTimes.length === 0) {
            throw new Error("Selected time is not valid.");
        }

       
        await createCalendarEvent({
            ...data,
            startTime: startInTimezone, 
            durationInMinutes: event.durationInMinutes,
            eventName: event.name,
        });
        return { clerkUserId: data.clerkUserId, eventId: data.eventId, startTime: data.startTime }
    } catch (error: any) {
        console.error(`Error creating meeting: ${error.message || error}`);
        throw new Error(`Failed to create meeting: ${error.message || error}`);
    }
}