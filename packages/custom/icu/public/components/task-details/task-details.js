'use strict';

angular.module('mean.icu.ui.taskdetails', []).controller('TaskDetailsController', TaskDetailsController);

function TaskDetailsController($scope, entity, tags, projects, tasks, subtasks, $state, $rootScope, $timeout, context, $stateParams,
                               me, people,
                               TasksService, ActivitiesService, PermissionsService,
                               ProjectsService, EntityService, DetailsPaneService) {

  // ==================================================== init ==================================================== //

  $scope.tabs = DetailsPaneService.orderTabs(['activities', 'documents', 'officeDocuments']);

    $scope.item = typeof entity === 'object'? entity : context.entity;
    $scope.entityType = 'tasks';

  if (!$scope.item) {
    $state.go('main.tasks.byentity', {
      entity: context.entityName,
      entityId: context.entityId
    });
  } else if ($scope.item && ($state.current.name === 'main.tasks.byentity.details' || $state.current.name === 'main.search.task' || $state.current.name === 'main.tasks.all.details' || $state.current.name === 'main.tasks.byassign.details')) {
    $state.go('.' + window.config.defaultTab);
  }

  $scope.editorOptions = {
    theme: 'bootstrap',
    buttons: ['bold', 'italic', 'underline', 'anchor', 'quote', 'orderedlist', 'unorderedlist']
  };
  $scope.statuses = ['new', 'assigned', 'in-progress', 'review', 'rejected', 'done'];

  $scope.me = me;
  $scope.tags = tags;
  $scope.projects = projects.data || projects;

  var currentState = $state.current.name;

  // backup for previous changes - for updates
  var backupEntity = angular.copy($scope.item);

  $scope.people = people;

  $rootScope.$broadcast('updateNotification', {
    taskId: $stateParams.id
  });

  if ($scope.item._id) {
    TasksService.getStarred().then(function(starred) {
      $scope.item.star = _(starred).any(function(s) {
        return s._id === $scope.item._id;
      });
    });

    TasksService.getTemplate().then(function(template) {
      $scope.template = template;
    });
  }

    // ==================================================== onChanges ==================================================== //

  $scope.onStar = function(value) {

    TasksService.updateStar($scope.item, me, backupEntity).then(function(result) {
        backupEntity = angular.copy($scope.item);
        ActivitiesService.data.push(result);
    });

    TasksService.star($scope.item).then(function() {
        $state.reload();
    });

  }

  $scope.onAssign = function(value) {
    $scope.item.assign = value;
    $scope.updateAndNotify($scope.item);
  }

  $scope.onDateDue = function(value) {
    $scope.item.due = value;
    if (context.entityName === 'discussion') {
      $scope.item.discussion = context.entityId;
    }

    TasksService.updateDue($scope.item, me, backupEntity).then(function(result) {
      backupEntity = angular.copy($scope.item);
      ActivitiesService.data.push(result);
    });

    TasksService.update($scope.item).then(function(result) {
      if (context.entityName === 'project') {
        var projId = result.project ? result.project._id : undefined;
        if (projId !== context.entityId) {
          $state.reload();
        }
      }
    });
  };

  $scope.onStatus = function(value) {
    $scope.item.status = value;

    if (context.entityName === 'discussion') {
      $scope.item.discussion = context.entityId;
    }

    TasksService.updateStatus($scope.item, me, backupEntity).then(function(result) {
      backupEntity = angular.copy($scope.item);
      ActivitiesService.data.push(result);
    });

    TasksService.update($scope.item).then(function(result) {
      refreshList();
    });
  }

  $scope.onTags = function(value) {
    $scope.item.tags = value;
    $scope.update($scope.item);

    TasksService.updateTags($scope.item, me, backupEntity).then(function(result) {
      backupEntity = angular.copy($scope.item);
      ActivitiesService.data.push(result);
    });
  }

  // ==================================================== Menu events ==================================================== //

  $scope.recycle = function() {
    TasksService.removeFromParent($scope.item).then(()=>{
      EntityService.recycle('tasks', $scope.item._id).then(function() {
        $scope.item.recycled = new Date();
        let clonedEntity = angular.copy($scope.item);
        clonedEntity.status = "deleted";
        // just for activity status
        TasksService.updateStatus(clonedEntity, me, $scope.item).then(function(result) {
          ActivitiesService.data.push(result);
        });
        refreshList();
        $state.go('^.^');
        $scope.isRecycled = $scope.item.hasOwnProperty('recycled');
        $scope.permsToSee();
        $scope.havePermissions();
        $scope.haveEditiorsPermissions();
      });
    })
  }

  $scope.recycleRestore = function() {
    let entity = $scope.item;
    TasksService.addToParent(entity).then(()=>{
      EntityService.recycleRestore('tasks', entity._id).then(function() {
        let clonedEntity = angular.copy(entity);
        clonedEntity.status = "un-deleted";
        // just for activity status
        TasksService.updateStatus(clonedEntity, me, entity).then(function(result) {
          ActivitiesService.data.push(result);
        });
        refreshList();
        $state.go('^.^');
      });
    }
    )
  }

  $scope.item.subTasks = subtasks.data || subtasks;

  var creatingStatuses = {
    NotCreated: 0,
    Creating: 1,
    Created: 2
  };

  $scope.duplicate = function() {
    let newItem = {
      title: '',
      watchers: [],
      tags: [],
      __state: creatingStatuses.NotCreated,
      __autocomplete: false
    };

    let duplicate = _.pick($scope.item,
      [
        'title',
        'description',
        'due'
      ]);

    Object.assign(newItem, duplicate);

    if($state.includes('main.tasks.byassign')) {
      newItem.assign = me._id;
      newItem.status = 'assigned';
    }

    TasksService.create(newItem)
      .then( result => {
        $state.go('^.^', {}, { reload: true });
      })
  };

  $scope.menuItems = [{
    label: 'duplicateTask',
    fa: 'fa-copy',
    display: true,
    action: $scope.duplicate,
  },{
    label: 'recycleTask',
    fa: 'fa-times-circle',
    display: !$scope.item.hasOwnProperty('recycled'),
    action: $scope.recycle,
  }, {
    label: 'unrecycleTask',
    fa: 'fa-times-circle',
    display: $scope.item.hasOwnProperty('recycled'),
    action: $scope.recycleRestore,
  }];

  // ==================================================== Buttons ==================================================== //

  $scope.updateStatusForApproval = function() {
    $scope.onStatus("waiting-approval");
  }

  // ==================================================== Category ==================================================== //

  $scope.onTaskRelation = function(value) {
    $scope.item.discussion = value ? value : {};
    $scope.update($scope.item, 'discussion');
  };

  $scope.onCategory = function(value) {
    $scope.item.project = value;
    $scope.update($scope.item, 'project');
  }

  // ==================================================== Template ==================================================== //

  $scope.saveTemplate = function(newTemplate) {
    return TasksService.saveTemplate($stateParams.id, newTemplate)
  }

  $scope.deleteTemplate = function(id) {
    return TasksService.deleteTemplate(id)
  }

  $scope.implementTemplate = function(id) {
    return TasksService.template2subTasks(id, {
      'taskId': $stateParams.id
    }).then(function(result) {
      result.forEach(subTask => {
        delete subTask._id;
        delete subTask.id;
        TasksService.create(subTask).then(result => {
          result.isNew = true;
          $scope.item.subTasks.splice($scope.item.subTasks.length-1, 0, result);
          $timeout(function() {
            result.isNew = false;
          }, 5000);
        });
      });
    });
  }

  // ==================================================== $watch: title / desc ==================================================== //

  $scope.$watch('item.title', function(nVal, oVal) {
    if (nVal !== oVal) delayedUpdateTitle($scope.item, 'title');
  });

  $scope.$watch('item.description', function(nVal, oVal) {
    if (nVal !== oVal) delayedUpdateDesc($scope.item, 'description');
  });

  function refreshList() {
    $rootScope.$broadcast('refreshList');
  }

  var refreshView = function() {
    var state = context.entityName === 'all' ? 'main.tasks.all' : context.entityName === 'my' ? 'main.tasks.byassign' : 'main.tasks.byentity';
    TasksService.getWatchedTasks().then(function(result) {
      TasksService.watchedTasksArray = result;
      $state.go(state, {
        entity: context.entityName,
        entityId: context.entityId
      }, {
        reload: true
      });

    });
  }

  // ==================================================== Update  ==================================================== //

  //Made By OHAD
  $scope.updateAndNotify = function(item) {
    item.status = $scope.statuses[1];
    if (context.entityName === 'discussion') {
      item.discussion = context.entityId;
    }

    if (item.assign === undefined || item.assign === null) {
      delete item['assign'];
    } else {
      // check the assignee is not a watcher already
      let filtered = item.watchers.filter(watcher=>{
        return watcher._id == item.assign
      }
      );

      if (filtered.length == 0) {
        item.watchers.push(item.assign);
      }
    }

    TasksService.update(item).then(function(result) {
      if (context.entityName === 'project') {
        var projId = result.project ? result.project._id : undefined;
        if (projId !== context.entityId) {
          $state.reload();
        }
      }

      TasksService.assign(item, me, backupEntity).then(function(res) {
        backupEntity = angular.copy(result);
        ActivitiesService.data.push(res);
      });
    });
  };

  function unionById(arr1, arr2){
    let existing = arr1.map(e => (e.id || e._id).toString());
    arr2.forEach(e => {
      let id = (e.id || e._id).toString();
      if(!existing.includes(id)) {
        arr1.push(e);
      }
    })
    return arr1;
  }

  $scope.update = function(item, type, proj) {
    if (proj && proj !== '') {
      $scope.createProject(proj, function(result) {
        item.project = result;
        TasksService.update(item).then(function(result) {
          backupEntity = angular.copy($scope.item);

          if (context.entityName === 'project') {
            var projId = result.project ? result.project._id : undefined;
            if (projId !== context.entityId || type === 'project') {
              $state.go('main.tasks.byentity.details', {
                entity: context.entityName,
                entityId: projId,
                id: item._id
              }, {
                reload: true
              });
            }
          }
        });
      });
    }
    if (context.entityName === 'discussion') {
      item.discussion = context.entityId;
    }
    if (type === 'project' && item.project) {
      item.watchers = unionById(item.watchers, item.project.watchers);
      item.permissions = unionById(item.permissions, item.project.permissions);
    }
    if (type === 'discussion' && item.discussion) {
      item.watchers = unionById(item.watchers, item.discussion.watchers);
      item.permissions = unionById(item.permissions, item.discussion.permissions);
    }

    TasksService.update(item).then(function(result) {
      if (type === 'project') {
          backupEntity = angular.copy($scope.item);
      }
      var isSearchState = currentState.indexOf('search') != -1;
      if (context.entityName === 'project' && !isSearchState) {
        var projId = result.project ? result.project._id : undefined;
        if (!projId) {
          $state.go('main.tasks.all.details', {
            entity: 'task',
            id: item._id
          }, {
            reload: true
          });
        } else if (!isSearchState) {
          if (projId !== context.entityId || type === 'project') {
            $state.go('main.tasks.byentity.details', {
              entity: context.entityName,
              entityId: projId,
              id: item._id
            }, {
              reload: true
            });
          }
        }
      }
      if (type === 'title' || type === 'description') {
        let func = type === 'title' ? 'updateTitle' : 'updateDescription';
        TasksService[func](item, me, backupEntity).then(function(result) {
          backupEntity = angular.copy($scope.item);
          ActivitiesService.data = ActivitiesService.data || [];
          ActivitiesService.data.push(result);
          refreshList();
        });
      }
    });
  }

  var delayedUpdateTitle = _.debounce($scope.update, 2000);
  var delayedUpdateDesc = _.debounce($scope.update, 2000);

  // ==================================================== havePermissions ==================================================== //

  $scope.enableRecycled = true;
  $scope.isRecycled = $scope.item.hasOwnProperty('recycled');

  $scope.havePermissions = function(type, enableRecycled) {
    enableRecycled = enableRecycled || !$scope.isRecycled;
    return (PermissionsService.havePermissions($scope.item, type) && enableRecycled);
  };

  $scope.haveEditiorsPermissions = function() {
    return PermissionsService.haveEditorsPerms($scope.item);
  };

  $scope.permsToSee = function() {
    return PermissionsService.haveAnyPerms($scope.item);
  };

}

