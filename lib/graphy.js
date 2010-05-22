var Graphy = function(x, y, w, h) {
  var paper = Raphael(x, y, w, h);
  var nodes = [];
  var springs = [];
  var maxIters = 300;
  var iterationIterval = 30 //ms
  var minusAverageKineticEnergy = 1.5;
  
  var chargeConst = null;
  
  var any = function(list, iterator) {
    for(var i = 0; i < list.length; i++) {
      if(iterator(list[i])) {
        return true;
      }
    }
    return false;
  }
  
  var detect = function(list, iterator) {
    for(var i = 0; i < list.length; i++) {
      if(iterator(list[i])) {
        return list[i];
      }
    }          
  }
  
  var randomPosNearCenter = function() {
    var x = (w / 3.0) + Math.random() * w * 1.0 / 3.0;
    var y = (h / 3.0) + Math.random() * h * 1.0 / 3.0;

    return [x, y];
  }
  
  var updateNodes = function(damping) {

    $.map(nodes, function(node) {
      var netForceX = 0;
      var netForceY = 0;
      
      $.map(nodes, function(anotherNode) {
        if(anotherNode === node) { return; }
        netForceX += node.coulombRepulsionXTo(chargeConst, anotherNode);
        netForceY += node.coulombRepulsionYTo(chargeConst, anotherNode);
      })

      $.map(nodes, function(anotherNode) {
        if(anotherNode == node) { return; }
        netForceX += node.hooksForceX();
        netForceY += node.hooksForceY();
      })
      
      node.force(netForceX, netForceY);
    })
    
    var maxMovment = 0;
    $.map(nodes, function(node){
      maxMovment = Math.max(maxMovment, node.actOnForce(iterationIterval, damping));
    })

    $.map(springs, function(spring){
      spring.paint();
    })
    
    return maxMovment;
  }
  
  var totalKineticEnergy = function() {
    var result = 0;
    $.map(nodes, function(node) {
      result += node.kineticEnergy();
    })
    return result;
  }
  
  var calcMotionRatio = function(maxMovement, lastMaxMovement) {
    console.log("maxMovement = %f", maxMovement)
    console.log("lastMaxMovement = %f", lastMaxMovement)
    if(maxMovement == 0) {
      return 0;
    }
    return (lastMaxMovement / maxMovement) - 1.0;
  }
  
  var drawIteration = function(currentIteration, damping, lastMaxMovement) {
    console.log("currentIteration = %i", currentIteration)
    console.log("damping = %f", damping)
    if( currentIteration == 0 || damping == 0) {
      $.map(nodes, function(node) { node.stop() });
      return;
    }
    
    var maxMovement = updateNodes(damping);
    
    if(maxMovement < 1) {
      $.map(nodes, function(node) { node.stop() });
      return;      
    }
    setTimeout(function() {
      drawIteration(currentIteration - 1, regression(damping, maxMovement, lastMaxMovement), maxMovement);
    }, iterationIterval);
    
  }

  var regression = function(damping, maxMovement, lastMaxMovement) {
    var motionRatio = calcMotionRatio(maxMovement, lastMaxMovement);
    console.log(motionRatio)
    if(motionRatio < 0.001) { //things are running faster
      
       //If max motion<0.2, damp away
       //If by the time the damper has ticked down to 0.9, maxMotion is still>1, damp away
       //We never want the damper to be negative though
       if ((maxMovement < 1.0 || ( maxMovement > 5 && damping < 0.9) ) && damping > 0.1) {
         return damping - 0.1;
       } 
       
       //If we've slowed down significanly, damp more aggresively (then the line two below)       
       if (maxMovement < 2.0 && damping > 0.015 ) {
         return damping - 0.015;
       } 
       
       //If max motion is pretty high, and we just started damping, then only damp slightly
       if ( damping > 0.0005 ) {
         return damping - 0.0005; 
       }
    }
    return damping;
  }
  
  var findOrCreateNode = function(name) {
    var exist = detect(nodes, function(node) {
      return node.name() == name;
    })
    
    if(exist) { return exist; }
    
    var node = new Graphy.Node(public, paper, name);
    node.paint(randomPosNearCenter());
    nodes.push(node);
    return node;
  }
  
  var public =  {
    createNode: function(name) {
      findOrCreateNode(name);
    },
    
    chargeConst: function() {
      return chargeConst;
    },
    
    add: function(left, link, right) {
      var leftNode = findOrCreateNode(left);
      var rightNode = findOrCreateNode(right);
      var spring = new Graphy.Spring(paper, link, leftNode, rightNode);
      spring.paint(paper);
      springs.push(spring);
    },
    
    draw: function() {
      chargeConst = 100
      drawIteration(maxIters, 1, 0);
    }
  }
  return public;
}


Graphy.Node = function(graph, paper, name) {
  var springs = [];
  var x = 0.0;
  var y = 0.0;
  var r = 20.0;
  var view = null;
  var tooltip = null
  var vx = 0.0;
  var vy = 0.0;
  var fx = 0.0;
  var fy = 0.0;
  var mass = 10;
  
  var showTooltip = function() {
    if(vx!=0 || vy!=0) {
      return;
    }
    tooltip = paper.text(x - 5, y - 35, name);
    tooltip.attr({fill: '#4F575E', font: '20px Verdana'});
  }
  
  var hideTooltip = function() {
    if(tooltip) {
      tooltip.remove();
    }
  }
  
  var constrain = function(value, constrain) {
    return Math.max(-1 * constrain, Math.min(value, constrain));
  }
  
  var move = function(dx, dy) {
    dx = constrain(dx, 10);
    dy = constrain(dy, 10);
    
    x = x + dx;
    y = y + dy;
    view.translate(dx, dy);
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  var distance = function(node) {
    var x1 = node.x();
    var y1 = node.y();
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }
  
  var distanceSq = function(node) {
    var x1 = node.x();
    var y1 = node.y();
    return (x - x1) * (x - x1) + (y - y1) * (y - y1);
  }
  
  var distanceToPoint = function(x1, y1) {
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }
  
  var public = {
    name: function() {return name },
    x: function() { return x; },
    y: function() { return y; },
    
    distance: distance,
    
    force: function(forceX, forceY) {
      fx = forceX;
      fy = forceY;
    },
    
    addSpring: function(s) {
      springs.push(s);
    },
    
    kineticEnergy: function() {
      return mass * Math.sqrt(vx * vx + vy * vy);
    },
    
    coulombRepulsionXTo: function(chargeConst, anotherNode) {
      return chargeConst * (x - anotherNode.x()) / (distanceSq(anotherNode) * distance(anotherNode));
    },
    
    coulombRepulsionYTo: function(chargeConst, anotherNode) {
      return chargeConst * (y - anotherNode.y()) / (distanceSq(anotherNode) * distance(anotherNode));
    },
    
    hooksForceX: function() {
      var fx = 0;
      $.map(springs, function(spring) {
        var another = spring.theOtherEndOf(public);
        var len = distance(another);
        fx +=  spring.force(len) * ( x - another.x() ) / len;
      })
      return fx;
    },
    
    hooksForceY: function() {
      var fy = 0;
      $.map(springs, function(spring) {
        var another = spring.theOtherEndOf(public);
        var len = distance(another);
        fy +=  spring.force(len) * ( y - another.y() ) / len;
      })
      return fy;
    },
    
    actOnForce: function(duration, damping) {
      vx = (vx +  (fx / mass) * duration) * damping;
      vy = (vy +  (fy / mass) * duration) * damping;
      return move(duration * vx, duration * vy);
    },
    
    stop: function() {
      vx = 0.0;
      vy = 0.0;
      fx = 0.0;
      fy = 0.0;
    },
    
    posString: function() {
      return x + " " + y;
    },
    
    overlap: function(x1, y1) {
      return distanceToPoint(x1, y1) < 2 * r;
    },
    
    paint: function(pos) {
      if(!view) {
        x = pos[0];
        y = pos[1];
        view = paper.circle(x, y, r);
        view.attr("fill", "#00bdf3");
        view.attr("stroke", "#fff");
        view.node.setAttribute("title", name);
        view.node.onmouseover = showTooltip;
        view.node.onmouseout = hideTooltip;
      }
    }
  }
  return public;
}

Graphy.Spring = function(paper, name, leftNode, rightNode) {
  var view = null;
  var idealLength = 60;
  var forceConst = 0.00003;
  
  var public = {
    force: function() {
      var dist = leftNode.distance(rightNode);
      var delta = Math.max(0, dist - idealLength);
      return (-1.0) * forceConst * delta;
    },
    
    paint: function() {
      var pathString = "M" + leftNode.posString() + "L" + rightNode.posString();
      if(view) {
        view.attr("path", pathString);
      } else {
        view = paper.path(pathString).toBack();
        view.node.setAttribute("title", name);              
      }
    },
    
    theOtherEndOf: function(node) {
      if(leftNode === node) { return rightNode; }
      if(rightNode === node) { return leftNode; }
    }
  }
  
  leftNode.addSpring(public);
  rightNode.addSpring(public);
  
  return public;
}