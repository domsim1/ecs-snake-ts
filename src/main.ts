import * as PIXI from 'pixi.js';
import * as ApeECS from 'ape-ecs';

const cellSize = 30;
const energyBuffer = 30;
const width = 20 * cellSize;
const height = 15 * cellSize;

enum Direction {
    Left = 0,
    Up = 1,
    Right = 2,
    Down = 3
}

const app = new PIXI.Application({
  width,
  height,
});

const stage = new PIXI.Container(); 
const graphics = new PIXI.Graphics();
stage.addChild(graphics);

document.body.appendChild(app.view);

class Position extends ApeECS.Component {}
Position.properties = {
  x: 0,
  y: 0,
};

class Segment extends ApeECS.Component {}
Segment.properties = {
  parent: null,
  parentX: undefined,
  parentY: undefined,
};

// we could just make a separate action for each direction as tags
// but this is more flexible
class ActionMove extends ApeECS.Component {}
ActionMove.properties = {
  direction: 0,
  nextDirection: [],
  energy: 0,
};

class Snake extends ApeECS.Component {}
Snake.properties = {
  head: null,
  tail: null,
  shouldGrow: false,
};
class Fruit extends ApeECS.Component {}
Fruit.properties = {
  lifetime: 30 * energyBuffer
};
class SegmentMovementSystem extends ApeECS.System {
  moveQuery: ApeECS.Query;
  init() {

    // here we're just dealing with movement, but an action could be any action
    // that a player or game agent intends to take
    this.moveQuery = this.createQuery()
      .fromAll('Position', 'Segment');
  }
  update(delta) {
    const entities = this.moveQuery.refresh().execute();
    entities.forEach(entity => {
      const position = entity.getOne(Position);
      const segment = entity.getOne(Segment);
      if (segment.parent) {
        const parentPos = segment.parent.getOne(Position);
        if (segment.parentX === undefined) {
          segment.update({ parentX: parentPos.x, parentY: parentPos.y });
          return;
        }
        if (parentPos.x!==segment.parentX || parentPos.y !== segment.parentY) {
          position.update({ x: segment.parentX, y: segment.parentY });
          segment.update({ parentX: parentPos.x, parentY: parentPos.y });
        }
      }
    });
  }
}
class FruitSystem extends ApeECS.System {
  query: ApeECS.Query;
  init() {
    this.query = this.createQuery()
      .fromAll('Fruit');
  }
  update(tick) {
    const entities = this.query.refresh().execute();
    for (const entity of entities) {
      const fruit = entity.getOne(Fruit);
      fruit.update({ lifetime: fruit.lifetime - 1 });
      if (fruit.lifetime <= 0) {
        entity.destroy();
      }
    }
    if (entities.size === 0) {
      this.createFruit();
    }
  }
  createFruit() {
    const entity = this.world.createEntity({
      c: {
        Position: { x: Math.floor(Math.random() * width / cellSize) * cellSize, y: Math.floor(Math.random() * height / cellSize) * cellSize },
        Fruit: {}
      }
    });
  }
}
class CollisionSystem extends ApeECS.System {
  init() {

    // here we're just dealing with movement, but an action could be any action
    // that a player or game agent intends to take


  }
  update() {
    const snakes = this.createQuery()
    .fromAll('Snake').execute();
    const fruits = this.createQuery()
    .fromAll('Fruit').execute();
    let head;
    for (const snake of snakes) {
      head = snake.getOne(Snake).head;
      if (head) {
        const headPosition = head.getOne(Position);
        for (const fruit of fruits) {
          const fruitPosition = fruit.getOne(Position);
          if (headPosition.x === fruitPosition.x && headPosition.y === fruitPosition.y) {
            fruit.destroy();
            snake.getOne(Snake).update({ shouldGrow: true });

          }
        }
      }
    }
  }
}
class SnakeSystem extends ApeECS.System {
  query: ApeECS.Query;
  init() {

    // here we're just dealing with movement, but an action could be any action
    // that a player or game agent intends to take

    this.query = this.createQuery()
      .fromAll('Snake');
  }
  update() {
    const entities = this.query.execute();
    for (const entity of entities) {
      const snake = entity.getOne(Snake);
      if (snake.shouldGrow) {
        const tailPosition = snake.tail.getOne(Position);
        const newSegment = this.world.createEntity({
          c: {
              Position: { x: snake.tail.getOne(Position).x, y: snake.tail.getOne(Position).y },
              Segment: { parent: snake.tail, parentX: tailPosition.x, parentY: tailPosition.y }
            }
          });
        console.log(newSegment);
        snake.tail = newSegment;
        snake.shouldGrow = false;
      }
    }
  }
}
class ActionSystem extends ApeECS.System {
  moveQuery: ApeECS.Query;
  init() {

    // here we're just dealing with movement, but an action could be any action
    // that a player or game agent intends to take

    this.moveQuery = this.createQuery()
      .fromAll('Position','ActionMove');
  }

  update(tick) {
    const entities = this.moveQuery.execute();
    for (const entity of entities) {
      // getOne because we only expect one Position on an entity
      const pos = entity.getOne('Position');
      for (const move of entity.getComponents('ActionMove')) {
        if (move.energy > energyBuffer) {
          let newX = pos.x;
          let newY = pos.y;
          if (move.nextDirection.length) {
            move.direction = move.nextDirection.shift();
          }
          switch(move.direction) {
            case Direction.Left: { // left
              if (pos.x < cellSize) {
                newX = width - cellSize;
              } else {
                newX = pos.x - cellSize;
              }
            }
            break;
            case Direction.Up: {// up
              if (pos.y < cellSize) {
                newY = height - cellSize;
              } else {
                newY = pos.y - cellSize;
              }              
            }
            break;
            case Direction.Right: { // right
              if (pos.x >= width - cellSize) {
                newX = 0;
              } else {
                newX = pos.x + cellSize;
              }
            }
            break;
            case Direction.Down: { // down
              if (pos.y >= height - cellSize) {
                newY = 0;
              } else {
                newY = pos.y + cellSize;
              }
            }
          }
          pos.update({
            x: newX,
            y: newY,
          });
          move.energy = 0;
        } else {
          move.energy += 1;
        }
        // remove the used action
        // entity.removeComponent(move);
      }
    }
  }
}
class RenderSystem extends ApeECS.System {
  moveQuery: ApeECS.Query;
  init() {

    // here we're just dealing with movement, but an action could be any action
    // that a player or game agent intends to take

    this.moveQuery = this.createQuery()
      .fromAll('Position');
  }
  update(tick) {
    const entities = this.moveQuery.refresh().execute();
    for (const entity of entities) {
      // getOne because we only expect one Position on an entity
      const pos = entity.getOne('Position');
      let colour = entity.id === 'head' ? 0x9b59b6 : 0xff0000;
      if (entity.getOne('Fruit')) {
        colour = 0x00ff00;
      }
      graphics.beginFill(colour, 0.3);
      graphics.lineStyle(2, 0xffcc00); // Orange
      graphics.drawRect(pos.x, pos.y, cellSize, cellSize);
      graphics.endFill();
    }
  }
}
class GameLoop {
  world: ApeECS.World;
  playerQuery: ApeECS.Query;
  constructor() {

    this.world = new ApeECS.World();
    // register your components
    this.world.registerComponent(Position, 10);
    this.world.registerComponent(ActionMove, 10);
    this.world.registerComponent(Segment, 10);
    this.world.registerComponent(Snake, 10);
    this.world.registerComponent(Fruit, 10);
    this.world.registerTags('Character', 'PlayerControlled');
    this.world.registerSystem('everyframe', ActionSystem);
    this.world.registerSystem('everyframe', SegmentMovementSystem);
    this.world.registerSystem('everyframe', RenderSystem);
    this.world.registerSystem('everyframe', FruitSystem);
    this.world.registerSystem('everyframe', CollisionSystem);
    
    const snakeSystem = this.world.registerSystem('everyframe', SnakeSystem);
    
    const head = this.world.createEntity({
      id: 'head',
      tags: ['PlayerControlled'],
      c: {
        Position: { x: cellSize * 2, y: 0 },
        ActionMove: { direction: Direction.Down, nextDirection: [], energy: 1 }
      }
    });
    const snake = this.world.createEntity({
      id: 'snake',
      c: {
        Snake: { head, tail: head },
      }
    });

    this.playerQuery = this.world.createQuery().fromAll('PlayerControlled', ActionMove);

    window.addEventListener('keydown', (e) => {
      // refresh, because the query is used more than once, and is not a system+persisted query
      const entities = this.playerQuery.refresh().execute();
      // maybe your controls move more than one character
      for (const player of entities) {
        const move = player.getOne(ActionMove);
        switch (e.code) {
          case 'ArrowUp':
            if (move.direction !== Direction.Up) {
              if (!move.nextDirection.length) {
                if (move.direction !== Direction.Down) {
                  move.nextDirection.push(Direction.Up);
                }
              }
              else if (move.nextDirection[move.nextDirection.length-1] !== Direction.Up &&
                move.nextDirection[move.nextDirection.length-1] !== Direction.Down) {
                move.nextDirection.push(Direction.Up);
              }
            }
            break;
          case 'ArrowDown':
            if (move.direction !== Direction.Down) {
              if (!move.nextDirection.length) {
                if (move.direction !== Direction.Up) {
                  move.nextDirection.push(Direction.Down);
                }
              }
              else if (move.nextDirection[move.nextDirection.length-1] !== Direction.Down &&
                move.nextDirection[move.nextDirection.length-1] !== Direction.Up) {
                move.nextDirection.push(Direction.Down);
              }
            }
            break;
          case 'ArrowLeft':
            if (move.direction !== Direction.Left) {
              if (!move.nextDirection.length) {
                if (move.direction !== Direction.Right) {
                  move.nextDirection.push(Direction.Left);
                }
              }
              else if (move.nextDirection[move.nextDirection.length-1] !== Direction.Left &&
                move.nextDirection[move.nextDirection.length-1] !== Direction.Right) {
                move.nextDirection.push(Direction.Left);
              }
            }
            break;
          case 'ArrowRight':
            if (move.direction !== Direction.Right) {
              if (!move.nextDirection.length) {
                if (move.direction !== Direction.Left) {
                  move.nextDirection.push(Direction.Right);
                }
              }
              else if (move.nextDirection[move.nextDirection.length-1] !== Direction.Right &&
                move.nextDirection[move.nextDirection.length-1] !== Direction.Left) {
                move.nextDirection.push(Direction.Right);
              }
            }
            break;
          case 'Space':
            snake.getOne(Snake).update({ shouldGrow: true });
            snakeSystem.update();
            break;
        }
      }
    });
  }
  update(dt: number) {
    this.world.runSystems('everyframe');
    this.world.tick();
    console.log(this.world.entities.size);
  }
}
let x = 0;
let xmovement = 0;
let ymovement = 0;
let lastTime = 0;
let xpos = 240;
let ypos = 150;

const speed = 1;
// function drawBox(time: number): PIXI.Container {
//   // graphics.beginFill(0x9b59b6); // Purple

//   // xmovement += speed * time;
//   // if (xmovement >= boxwidth) {
//   //   xpos = (xpos + boxwidth) % (width - boxwidth);
//   //   xmovement = 0;
//   // }
//   // // Draw a rectangle
//   // graphics.drawRect(xpos, ypos, boxwidth, boxwidth); 
//   // graphics.endFill();
//   // return stage;
// }
const game = new GameLoop();
const ticker = PIXI.Ticker.shared;
ticker.autoStart = false;
// ticker.speed = 0;
ticker.stop();
// Setup
ticker.add((time) => {
  app.renderer.render(stage);
  graphics.clear();
  game.update(time);
});

ticker.start();

