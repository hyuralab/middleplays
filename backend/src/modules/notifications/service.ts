// Notifications service - to be implemented with BullMQ in next session
// Placeholder for future implementation

export async function sendNotification(userId: number, type: string, message: string): Promise<void> {
  // TODO: Queue notification job via BullMQ
  throw new Error('Notifications not yet implemented')
}
