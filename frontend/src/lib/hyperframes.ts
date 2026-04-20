/**
 * Hyperframes integration for rendering demo videos of the Cloudskraal app.
 *
 * Usage: Import and call renderDemo() to create a video walkthrough
 * of the task manager features.
 *
 * Docs: https://github.com/heygen-com/hyperframes
 *
 * Note: @hyperframes/core and @hyperframes/engine need to be installed
 * before imports below can be used. Install with:
 *   npm install @hyperframes/core @hyperframes/engine
 */

// Placeholder for future demo video scenes
export const TASK_MANAGER_SCENES = {
  smartListHome: {
    title: 'Task Manager Home',
    description: 'Smart list cards showing Today, Upcoming, All, Completed',
  },
  taskCompletion: {
    title: 'Task Completion Flow',
    description: 'Circle checkbox fills green, haptic, row fades',
  },
  inlineAdd: {
    title: 'Inline Task Creation',
    description: 'Type task with NLP parsing, enter to create, toast confirmation',
  },
  kanbanBoard: {
    title: 'Kanban Board',
    description: 'Drag tasks between status columns',
  },
  weatherBlocking: {
    title: 'Weather-Aware Blocking',
    description: 'Wind speed blocks spray tasks, shows when it clears',
  },
} as const;

export type SceneKey = keyof typeof TASK_MANAGER_SCENES;
